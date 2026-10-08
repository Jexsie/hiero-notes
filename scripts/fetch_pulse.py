#!/usr/bin/env python3
"""Collect structured activity data for the Pulse dashboard (site/src/app/pulse).

Fetches, across the hiero-ledger and LFDT-CLPR orgs:
  - every non-archived repo, with open issue/PR counts and recent releases
  - every open issue and open pull request
  - every issue and pull request closed (or merged) in the last WINDOW_DAYS days

and writes one compact JSON file. Uses `gh api graphql`, so it needs `gh` and a token
(`gh auth login` locally, GH_TOKEN in Actions).

    python3 scripts/fetch_pulse.py                         # writes site/public/pulse/pulse.json
    python3 scripts/fetch_pulse.py --user jexsie --out x.json
"""

import argparse
import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ORGS = ["hiero-ledger", "LFDT-CLPR"]
WINDOW_DAYS = 90
SEARCH_CAP = 1000  # GitHub search returns at most 1000 results per query
PAGE = 100
TITLE_CHARS = 120

# Accounts that are bots but show up as regular users.
BOT_LOGIN_RE = re.compile(r"\[bot\]|dependabot|renovate|github-actions|step-security|lfdt-bot|"
                          r"hedera-github-bot|swirlds-automation|codecov|snyk", re.I)

REPOS_QUERY = """
query($org: String!, $after: String) {
  organization(login: $org) {
    repositories(first: 100, after: $after, isArchived: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name description isFork pushedAt stargazerCount
        primaryLanguage { name }
        issues(states: OPEN) { totalCount }
        pullRequests(states: OPEN) { totalCount }
        releases(first: 15, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes { tagName publishedAt url isPrerelease isDraft }
        }
      }
    }
  }
}"""

ISSUE_FIELDS = """
  ... on Issue {
    number title createdAt updatedAt closedAt
    author { __typename login }
    repository { nameWithOwner }
    comments { totalCount }
    assignees(first: 3) { nodes { login } }
    labels(first: 6) { nodes { name } }
  }"""

PR_FIELDS = """
  ... on PullRequest {
    number title createdAt updatedAt closedAt mergedAt isDraft reviewDecision additions deletions
    author { __typename login }
    repository { nameWithOwner }
    labels(first: 6) { nodes { name } }
    reviewRequests(first: 5) { nodes { requestedReviewer { ... on User { login } } } }
  }"""

# Closed/merged PRs: no line counts (slow to compute on big merged PRs) and no review requests.
CLOSED_PR_FIELDS = """
  ... on PullRequest {
    number title createdAt updatedAt closedAt mergedAt isDraft
    author { __typename login }
    repository { nameWithOwner }
    labels(first: 6) { nodes { name } }
  }"""

SEARCH_QUERY = """
query($q: String!, $after: String, $first: Int!) {
  rateLimit { cost remaining }
  search(query: $q, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { %s }
  }
}"""

cost = {"points": 0, "calls": 0}


class GraphQLError(Exception):
    pass


def graphql(query, attempts=4, **variables):
    args = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        if value is None:
            continue
        args += ["-F" if isinstance(value, int) else "-f", f"{key}={value}"]
    err = None
    for attempt in range(attempts):
        proc = subprocess.run(args, capture_output=True, text=True)
        if proc.returncode == 0:
            data = json.loads(proc.stdout)
            if "errors" not in data:
                cost["calls"] += 1
                cost["points"] += (data["data"].get("rateLimit") or {}).get("cost", 1)
                return data["data"]
            err = data["errors"]
        else:
            err = proc.stderr.strip()[:300]
        log(f"retry {attempt + 1}/{attempts}: {str(err)[:160]}")
        # Secondary rate limits ask for a longer pause than a server hiccup does.
        time.sleep(30 if "rate limit" in str(err).lower() else 2 * (attempt + 1))
    raise GraphQLError(err)


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", file=sys.stderr, flush=True)


def org_query():
    return " ".join(f"org:{o}" for o in ORGS) + " archived:false"


def count(q):
    return graphql(SEARCH_QUERY % "__typename", q=q, first=1)["search"]["issueCount"]


def date_slices(q, lo, hi):
    """Yield (lo, hi) creation-date ranges that each hold at most SEARCH_CAP results."""
    n = count(f"{q} created:{lo}..{hi}")
    if n == 0:
        return
    if n <= SEARCH_CAP or lo == hi:
        yield lo, hi
        return
    a, b = date.fromisoformat(lo), date.fromisoformat(hi)
    mid = a + (b - a) // 2
    yield from date_slices(q, lo, mid.isoformat())
    yield from date_slices(q, (mid + timedelta(days=1)).isoformat(), hi)


def search_all(q, fields):
    """All results of a search, splitting by creation date to stay under the 1000 cap."""
    query = SEARCH_QUERY % fields
    out = []
    for lo, hi in date_slices(q, "2015-01-01", date.today().isoformat()):
        after, first = None, PAGE
        while True:
            try:
                res = graphql(query, attempts=2, q=f"{q} created:{lo}..{hi}", first=first, after=after)["search"]
            except GraphQLError:
                # Big pages with nested fields sometimes time out (HTTP 502); retry smaller.
                if first <= 10:
                    raise
                first //= 2
                continue
            out += [n for n in res["nodes"] if n]
            first = min(PAGE, first * 2)  # grow back after a success
            log(f"{q.split('archived:false')[-1].strip()} created:{lo}..{hi}: {len(out)} so far")
            if not res["pageInfo"]["hasNextPage"]:
                break
            after = res["pageInfo"]["endCursor"]
    return out


def fetch_repos():
    repos = []
    for org in ORGS:
        after = None
        while True:
            conn = graphql(REPOS_QUERY, org=org, after=after)["organization"]["repositories"]
            for r in conn["nodes"]:
                repos.append({
                    "o": org,
                    "n": r["name"],
                    "d": (r["description"] or "")[:200],
                    "lang": (r["primaryLanguage"] or {}).get("name"),
                    "stars": r["stargazerCount"],
                    "pushed": r["pushedAt"],
                    "fork": r["isFork"],
                    "oi": r["issues"]["totalCount"],
                    "op": r["pullRequests"]["totalCount"],
                    "rel": [[x["tagName"], x["publishedAt"], x["url"], x["isPrerelease"]]
                            for x in r["releases"]["nodes"] if x["publishedAt"] and not x["isDraft"]],
                })
            if not conn["pageInfo"]["hasNextPage"]:
                break
            after = conn["pageInfo"]["endCursor"]
    return repos


def is_bot(author):
    if not author:
        return True
    return author.get("__typename") == "Bot" or bool(BOT_LOGIN_RE.search(author.get("login", "")))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", default=None, help="GitHub login to highlight (default: the gh user)")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "site/public/pulse/pulse.json"))
    args = parser.parse_args()

    user = args.user or subprocess.run(["gh", "api", "user", "--jq", ".login"],
                                       capture_output=True, text=True).stdout.strip()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=WINDOW_DAYS)).date().isoformat()
    base = org_query()

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_repos = pool.submit(fetch_repos)
        f_open_issues = pool.submit(search_all, f"{base} is:issue is:open", ISSUE_FIELDS)
        f_closed_issues = pool.submit(search_all, f"{base} is:issue is:closed closed:>={cutoff}", ISSUE_FIELDS)
        f_open_prs = pool.submit(search_all, f"{base} is:pr is:open", PR_FIELDS)
        f_closed_prs = pool.submit(search_all, f"{base} is:pr is:closed closed:>={cutoff}", CLOSED_PR_FIELDS)
        repos = f_repos.result()
        issues = f_open_issues.result() + f_closed_issues.result()
        prs = f_open_prs.result() + f_closed_prs.result()

    repo_index = {f"{r['o']}/{r['n']}": i for i, r in enumerate(repos)}
    labels: dict[str, int] = {}

    def label_ids(node):
        return [labels.setdefault(l["name"], len(labels)) for l in node["labels"]["nodes"]]

    def short(ts):
        return ts[:16] + "Z" if ts else None  # minute precision is plenty

    out_issues, out_prs = [], []
    for it in issues:
        r = repo_index.get(it["repository"]["nameWithOwner"])
        if r is None:
            continue
        out_issues.append({
            "r": r, "n": it["number"], "t": it["title"][:TITLE_CHARS],
            "c": short(it["createdAt"]), "u": short(it["updatedAt"]), "x": short(it["closedAt"]),
            "au": (it["author"] or {}).get("login"), "b": 1 if is_bot(it["author"]) else 0,
            "k": it["comments"]["totalCount"],
            "a": [a["login"] for a in it["assignees"]["nodes"]],
            "l": label_ids(it),
        })
    for pr in prs:
        r = repo_index.get(pr["repository"]["nameWithOwner"])
        if r is None:
            continue
        out_prs.append({
            "r": r, "n": pr["number"], "t": pr["title"][:TITLE_CHARS],
            "c": short(pr["createdAt"]), "u": short(pr["updatedAt"]),
            "x": short(pr["closedAt"]), "m": short(pr["mergedAt"]),
            "d": 1 if pr["isDraft"] else 0,
            "rv": {"APPROVED": "A", "CHANGES_REQUESTED": "C", "REVIEW_REQUIRED": "R"}.get(pr.get("reviewDecision")),
            "ad": pr.get("additions", 0), "de": pr.get("deletions", 0),
            "au": (pr["author"] or {}).get("login"), "b": 1 if is_bot(pr["author"]) else 0,
            "rr": [x["requestedReviewer"]["login"] for x in (pr.get("reviewRequests") or {"nodes": []})["nodes"]
                   if x["requestedReviewer"] and x["requestedReviewer"].get("login")],
            "l": label_ids(pr),
        })

    data = {
        "generatedAt": now.isoformat(timespec="minutes").replace("+00:00", "Z"),
        "windowDays": WINDOW_DAYS,
        "cutoff": cutoff,
        "user": user,
        "orgs": ORGS,
        "repos": repos,
        "labels": list(labels),
        "issues": out_issues,
        "prs": out_prs,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size // 1024} KB): {len(repos)} repos, {len(out_issues)} issues, "
          f"{len(out_prs)} PRs; {cost['calls']} GraphQL calls, ~{cost['points']} points", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except GraphQLError as e:
        sys.exit(f"ERROR: GitHub GraphQL request failed after retries: {e}")
