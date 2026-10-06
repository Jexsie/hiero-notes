#!/usr/bin/env python3
"""Collect hiero-ledger GitHub activity, discussions, focus-repo status and contribution candidates.

Usage (from the repo root):
    python3 .claude/scripts/fetch_activity.py               # last 24h (72h on Mondays)
    python3 .claude/scripts/fetch_activity.py --hours 168   # last week
    python3 .claude/scripts/fetch_activity.py --user jexsie # personal sections for a named user

In GitHub Actions, pass --user: there `@me` would mean the Actions bot, not you.
Requires the GitHub CLI (gh), authenticated via `gh auth login` or a GH_TOKEN env var.
The lists below control which repos get detail; edit them rather than the code.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ORG = "hiero-ledger"

# Daily news: every human issue/PR in these repos is listed with an excerpt.
WATCHLIST = [
    "hiero-improvement-proposals",
    "sdk-collaboration-hub",
    "hiero-sdk-tck",
    "hiero-sdk-java",
    "hiero-sdk-js",
    "hiero-sdk-go",
    "hiero-sdk-python",
    "hiero-sdk-rust",
    "hiero-sdk-cpp",
    "hiero-sdk-swift",
    "solo",
    "hiero-solo-action",
    "hiero-mirror-node",
    "hiero-block-node",
    "hiero-json-rpc-relay",
]
# Older items in these repos are shown when they get new activity (long-running discussions).
DISCUSSION_REPOS = ["hiero-improvement-proposals", "sdk-collaboration-hub"]
RELEASE_REPOS = WATCHLIST + [
    "hiero-consensus-node",
    "hiero-cli",
    "hiero-enterprise-java",
    "hiero-mirror-node-explorer",
]

# Focus repos: deep dive (open PRs, open issues, recent merges) and the only source of
# contribution suggestions. Mostly TypeScript/JavaScript, plus the Java SDK.
FOCUS_REPOS = [
    "hiero-sdk-js",
    "hiero-sdk-tck",
    "hiero-sdk-java",
    "solo",
    "hiero-solo-action",
    "hiero-json-rpc-relay",
]
FOCUS_ACTIVE_DAYS = 30   # open issues updated within this many days are listed individually
FOCUS_MERGED = 20        # recent merges listed per focus repo
# SDKs compared for parity (what landed elsewhere and may be missing in a focus SDK).
PARITY_REPOS = [
    "hiero-sdk-java", "hiero-sdk-js", "hiero-sdk-go", "hiero-sdk-python",
    "hiero-sdk-rust", "hiero-sdk-cpp", "hiero-sdk-swift", "hiero-sdk-tck",
]
PARITY_DAYS = 30
CANDIDATES_PER_REPO = 6  # per focus repo, candidates whose comments and linked PRs get checked

BOT_RE = re.compile(r"dependabot|renovate|github-actions|\[bot\]|step-security|^app/", re.I)
DEPS_TITLE_RE = re.compile(r"^(chore|build|ci)(\(deps[^)]*\))?:\s*(bump|update)|^bump ", re.I)
LOW_SIGNAL_LABEL_RE = re.compile(r"good.first.issue|beginner", re.I)
CONTRIB_LABEL_RE = re.compile(
    r"good.first|help.wanted|beginner|intermediate|advanced|hacktoberfest|up.for.grabs", re.I)
SKIP_LABEL_RE = re.compile(r"blocked|on.hold|wontfix|won't.fix|duplicate|invalid", re.I)
CLAIM_RE = re.compile(
    r"\b(can|could|may) i (work|take|pick|try)|i'?d (like|love) to (work|take|pick|try|contribute)"
    r"|i would (like|love) to (work|take|pick)|assign (this |it )?(to )?me|/assign"
    r"|i'?ll (work|take|pick)|i will (work|take|pick)|working on (this|it)\b", re.I)

ITEM_FIELDS = "number,title,url,author,labels,repository,createdAt,updatedAt,body,state,commentsCount"
PR_FIELDS = ITEM_FIELDS + ",isDraft"
LIMIT = 300
EXCERPT_CHARS = 300

warnings = []
calls = {"ok": 0}


# ---------- GitHub helpers ----------

def _run(args):
    proc = subprocess.run(["gh", *args], capture_output=True, text=True)
    if proc.returncode != 0:
        warnings.append(f"`gh {' '.join(args[:4])} ...` failed: {proc.stderr.strip()[:200]}")
        return None
    calls["ok"] += 1
    return proc.stdout


def gh(args):
    """Runs gh and parses one JSON document. Returns [] on failure."""
    out = _run(args)
    if out is None:
        return []
    try:
        data = json.loads(out or "[]")
    except json.JSONDecodeError:
        warnings.append(f"`gh {' '.join(args[:4])} ...` returned non-JSON output")
        return []
    if isinstance(data, list) and len(data) >= LIMIT:
        warnings.append(f"`gh {' '.join(args[:4])} ...` hit the {LIMIT}-item limit; results are incomplete")
    return data


def gh_api_items(path, jq_object):
    """Paginated REST call; jq_object projects each element. Returns a list of dicts."""
    out = _run(["api", "--paginate", path, "--jq", f".[] | {jq_object} | @json"])
    if out is None:
        return []
    items = []
    for line in out.splitlines():
        line = line.strip()
        if line:
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return items


def search(kind, *qualifiers, fields=ITEM_FIELDS):
    return gh(["search", kind, *qualifiers, "--limit", str(LIMIT), "--json", fields])


# ---------- formatting helpers ----------

def repo_of(item):
    return item.get("repository", {}).get("name", "?")


def author_of(item):
    a = item.get("author") or {}
    return a.get("login", "?") if isinstance(a, dict) else str(a)


def is_bot(item):
    a = item.get("author") or {}
    return bool(BOT_RE.search(author_of(item))) or (isinstance(a, dict) and a.get("is_bot"))


def labels_of(item):
    return [l.get("name", "") if isinstance(l, dict) else l for l in item.get("labels", [])]


def is_low_signal(item):
    return any(LOW_SIGNAL_LABEL_RE.search(l) for l in labels_of(item))


def clean(text, limit=EXCERPT_CHARS):
    text = re.sub(r"<!--.*?-->", " ", text or "", flags=re.S)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def days_ago(iso, now):
    try:
        return (now - datetime.fromisoformat(iso.replace("Z", "+00:00"))).days
    except (AttributeError, ValueError):
        return "?"


def fmt_item(item, with_body=True, excerpt_chars=EXCERPT_CHARS):
    meta = [f"by {author_of(item)}"]
    labels = labels_of(item)
    if labels:
        meta.append("labels: " + ", ".join(labels))
    if item.get("isDraft"):
        meta.append("DRAFT")
    if item.get("commentsCount"):
        meta.append(f"{item['commentsCount']} comments")
    out = f"  #{item['number']} {item['title']}  [{'; '.join(meta)}]\n    {item['url']}"
    if with_body and not is_low_signal(item):
        ex = clean(item.get("body"), excerpt_chars)
        if ex:
            out += f"\n    > {ex}"
    return out


def repo_order(repo):
    return (0, WATCHLIST.index(repo)) if repo in WATCHLIST else (1, repo)


def print_section(title, items, with_body=True):
    """Human items grouped by repo. Returns bot-authored items for the noise count."""
    humans = [i for i in items if not is_bot(i)]
    bots = [i for i in items if is_bot(i)]
    print(f"\n== {title} ({len(humans)} human, {len(bots)} bot) ==")
    by_repo = defaultdict(list)
    for item in humans:
        by_repo[repo_of(item)].append(item)
    for repo in sorted(by_repo, key=repo_order):
        group = by_repo[repo]
        low = [i for i in group if is_low_signal(i)]
        normal = [i for i in group if not is_low_signal(i)]
        print(f"[{repo}] ({'watchlist' if repo in WATCHLIST else 'other'})")
        for item in normal:
            print(fmt_item(item, with_body=with_body,
                           excerpt_chars=EXCERPT_CHARS if repo in WATCHLIST else 150))
        if low:
            print(f"  + {len(low)} good-first-issue/beginner items: "
                  + "; ".join(f"#{i['number']} {i['title']}" for i in low[:15])
                  + (" …" if len(low) > 15 else ""))
    return bots


# ---------- sections ----------

def section_releases(since):
    print("\n== RELEASES ==")
    found = False
    for repo in RELEASE_REPOS:
        # REST, not `gh release list` (GraphQL), so this also works behind restrictive proxies.
        for rel in gh(["api", f"repos/{ORG}/{repo}/releases?per_page=10"]):
            published = rel.get("published_at") or ""
            if rel.get("draft") or not published or published < since:
                continue
            found = True
            pre = " (pre-release)" if rel.get("prerelease") else ""
            print(f"  [{repo}] {rel.get('tag_name')}{pre} {published[:10]}  {rel.get('html_url')}")
    if not found:
        print("  none")


DISCUSSIONS_QUERY = """
query($q: String!, $endCursor: String) {
  search(type: DISCUSSION, query: $q, first: 50, after: $endCursor) {
    pageInfo { hasNextPage endCursor }
    nodes { ... on Discussion {
      number title url createdAt updatedAt bodyText
      author { login } repository { name } category { name } comments { totalCount }
    } }
  }
}"""


def section_discussions(since):
    """GitHub Discussions (GraphQL only; works in Actions and locally, not behind the cloud proxy)."""
    out = _run(["api", "graphql", "--paginate", "-f", f"query={DISCUSSIONS_QUERY}",
                "-f", f"q=org:{ORG} updated:>={since}",
                "--jq", ".data.search.nodes[] | {number, title, url, created: .createdAt, "
                        "updated: .updatedAt, body: (.bodyText[0:400]), author: (.author.login // \"?\"), "
                        "repo: .repository.name, category: (.category.name // \"\"), "
                        "comments: .comments.totalCount} | @json"])
    items = [json.loads(l) for l in (out or "").splitlines() if l.strip()]
    print(f"\n== DISCUSSIONS (GitHub Discussions created or updated in window: {len(items)}) ==")
    by_repo = defaultdict(list)
    for d in items:
        by_repo[d.get("repo", "?")].append(d)
    for repo in sorted(by_repo, key=repo_order):
        print(f"[{repo}]")
        for d in sorted(by_repo[repo], key=lambda d: d.get("updated", ""), reverse=True):
            state = "NEW" if (d.get("created") or "") >= since else "new replies"
            print(f"  #{d['number']} {d['title']}  [{state}; {d.get('category')}; by {d.get('author')}; "
                  f"{d.get('comments', 0)} comments]\n    {d['url']}")
            if d.get("body"):
                print(f"    > {clean(d['body'])}")


OPEN_ISSUE_JQ = ("select(.pull_request | not) | {number, title, url: .html_url, "
                 "labels: [.labels[].name], assignees: [.assignees[].login], "
                 "milestone: (.milestone.title // null), comments, created: .created_at, "
                 "updated: .updated_at, author: .user.login, body: ((.body // \"\")[0:400])}")


def open_issues(repo):
    return gh_api_items(f"repos/{ORG}/{repo}/issues?state=open&per_page=100", OPEN_ISSUE_JQ)


def section_focus_repo(repo, since, now, issues):
    print(f"\n== FOCUS REPO: {repo} ==")
    print(f"(Links: https://github.com/{ORG}/{repo}/issues/<number> works for issues and PRs.)")

    prs = gh(["pr", "list", "--repo", f"{ORG}/{repo}", "--state", "open", "--limit", "100", "--json",
              "number,title,url,author,isDraft,reviewDecision,labels,createdAt,updatedAt,additions,deletions"])
    humans = [p for p in prs if not is_bot(p)]
    print(f"\n-- Open PRs: {len(humans)} human, {len(prs) - len(humans)} bot --")
    for p in sorted(humans, key=lambda p: p.get("updatedAt", ""), reverse=True):
        state = "DRAFT" if p.get("isDraft") else (p.get("reviewDecision") or "NO_REVIEW_DECISION")
        labels = ", ".join(labels_of(p))
        print(f"  #{p['number']} {p['title']}  [{state}; by {author_of(p)}; opened "
              f"{days_ago(p.get('createdAt'), now)}d ago; idle {days_ago(p.get('updatedAt'), now)}d; "
              f"+{p.get('additions', 0)}/-{p.get('deletions', 0)}" + (f"; labels: {labels}" if labels else "") + "]")

    active = [i for i in issues if days_ago(i.get("updated"), now) != "?"
              and days_ago(i.get("updated"), now) <= FOCUS_ACTIVE_DAYS]
    older = [i for i in issues if i not in active]
    print(f"\n-- Open issues: {len(issues)} total; {len(active)} active in the last {FOCUS_ACTIVE_DAYS} days "
          f"(listed), {len(older)} older --")
    for i in sorted(active, key=lambda i: i.get("updated", ""), reverse=True):
        who = ", ".join(i.get("assignees") or []) or "UNASSIGNED"
        meta = [who]
        if i.get("labels"):
            meta.append("labels: " + ", ".join(i["labels"]))
        if i.get("milestone"):
            meta.append(f"milestone: {i['milestone']}")
        meta.append(f"{i.get('comments', 0)} comments")
        meta.append(f"updated {days_ago(i.get('updated'), now)}d ago")
        meta.append(f"opened {days_ago(i.get('created'), now)}d ago")
        new = " NEW" if (i.get("created") or "") >= since else ""
        print(f"  #{i['number']}{new} {i['title']}  [{'; '.join(meta)}]")
    if older:
        label_counts = Counter(l for i in older for l in (i.get("labels") or []))
        unassigned = sum(1 for i in older if not i.get("assignees"))
        print(f"  Older open issues: {len(older)} ({unassigned} unassigned). Top labels: "
              + (", ".join(f"{l} {n}" for l, n in label_counts.most_common(8)) or "none"))
    milestones = Counter(i["milestone"] for i in issues if i.get("milestone"))
    if milestones:
        print("  Milestones: " + ", ".join(f"{m} ({n} open)" for m, n in milestones.most_common(5)))

    merged = gh(["pr", "list", "--repo", f"{ORG}/{repo}", "--state", "merged", "--limit", str(FOCUS_MERGED * 2),
                 "--json", "number,title,author,mergedAt"])
    merged = [m for m in merged if not is_bot(m) and not DEPS_TITLE_RE.search(m.get("title", ""))][:FOCUS_MERGED]
    print(f"\n-- Recently merged (last {FOCUS_MERGED}, bots and dependency bumps removed) --")
    for m in merged:
        print(f"  #{m['number']} {m['title']}  [{(m.get('mergedAt') or '')[:10]}; by {author_of(m)}]")


def section_parity(now):
    since30 = (now - timedelta(days=PARITY_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    repo_args = []
    for r in PARITY_REPOS:
        repo_args += ["--repo", f"{ORG}/{r}"]
    items = search("prs", *repo_args, "--merged-at", f">={since30}",
                   fields="number,title,url,author,repository,closedAt")
    items = [i for i in items if not is_bot(i) and not DEPS_TITLE_RE.search(i.get("title", ""))]
    print(f"\n== SDK PARITY: merged in the last {PARITY_DAYS} days (compare against the focus SDKs) ==")
    by_repo = defaultdict(list)
    for i in items:
        by_repo[repo_of(i)].append(i)
    for repo in PARITY_REPOS:
        group = by_repo.get(repo, [])
        print(f"[{repo}] {len(group)} merged")
        for i in group:
            print(f"  #{i['number']} {i['title']}  [{(i.get('closedAt') or '')[:10]}]")


def section_candidates(user, now, issues_by_repo):
    """Unassigned issues in the focus repos, with claim checks on the most promising per repo."""
    print(f"\n== CONTRIBUTION CANDIDATES (focus repos only; unassigned, not blocked; "
          f"top {CANDIDATES_PER_REPO} per repo checked) ==")
    print("Score: +2 contribution label, +2 HIP, +1 TCK, +1 active in 30 days.")
    for repo in FOCUS_REPOS:
        scored = []
        for i in issues_by_repo.get(repo, []):
            labels = i.get("labels") or []
            if i.get("assignees") or any(SKIP_LABEL_RE.search(l) for l in labels):
                continue
            title = i.get("title", "")
            age = days_ago(i.get("updated"), now)
            score = (2 if any(CONTRIB_LABEL_RE.search(l) for l in labels) else 0) \
                + (2 if re.search(r"\bHIP[- ]?\d+", title, re.I) else 0) \
                + (1 if re.search(r"\bTCK\b", title, re.I) else 0) \
                + (1 if age != "?" and age <= 30 else 0)
            scored.append((score, i.get("updated", ""), i))
        scored.sort(key=lambda c: (c[0], c[1]), reverse=True)
        print(f"\n[{repo}] {len(scored)} unassigned open issues")
        for score, _, i in scored[:CANDIDATES_PER_REPO]:
            n = i["number"]
            comments = gh_api_items(f"repos/{ORG}/{repo}/issues/{n}/comments?per_page=100",
                                    "{author: .user.login, created: .created_at, body: ((.body // \"\")[0:300])}")
            timeline = gh_api_items(f"repos/{ORG}/{repo}/issues/{n}/timeline?per_page=100",
                                    "select(.event == \"cross-referenced\" and .source.issue.pull_request != null) "
                                    "| {url: .source.issue.html_url, state: .source.issue.state}")
            claims = [c for c in comments if CLAIM_RE.search(c.get("body", "")) and c.get("author") != user]
            open_prs = [t["url"] for t in timeline if t.get("state") == "open"]
            flags = []
            if claims:
                flags.append(f"POSSIBLY CLAIMED by {claims[-1]['author']} {days_ago(claims[-1]['created'], now)}d ago")
            if open_prs:
                flags.append("OPEN PR LINKED: " + ", ".join(open_prs[:3]))
            labels = ", ".join(i.get("labels") or []) or "no labels"
            print(f"  #{n} {i['title']}  (score {score})")
            print(f"    {i['url']}")
            print(f"    {labels}; {i.get('comments', 0)} comments; updated {days_ago(i.get('updated'), now)}d ago; "
                  f"opened {days_ago(i.get('created'), now)}d ago by {i.get('author')}")
            print(f"    STATUS: {'; '.join(flags) or 'looks free'}")
            if i.get("body"):
                print(f"    > {clean(i['body'])}")
            for c in comments[-2:]:
                print(f"    last comment by {c['author']} ({days_ago(c['created'], now)}d ago): {clean(c['body'], 200)}")


def section_your_work(user, window, now):
    print(f"\n== YOUR WORK ({user}) ==")
    mine = search("prs", "--owner", ORG, "--author", user, "--state", "open", fields=PR_FIELDS)
    print(f"Your open PRs: {len(mine)}")
    for p in mine[:15]:
        detail = gh(["pr", "view", str(p["number"]), "--repo", f"{ORG}/{repo_of(p)}",
                     "--json", "reviewDecision,latestReviews,updatedAt"])
        if isinstance(detail, dict):
            reviews = ", ".join(f"{(r.get('author') or {}).get('login', '?')}: {r.get('state')}"
                                for r in detail.get("latestReviews", [])) or "no reviews yet"
            decision = detail.get("reviewDecision") or "NO_REVIEW_DECISION"
        else:
            reviews, decision = "unknown", "unknown"
        draft = "DRAFT; " if p.get("isDraft") else ""
        print(f"  [{repo_of(p)}] #{p['number']} {p['title']}  [{draft}{decision}; {reviews}; "
              f"idle {days_ago(p.get('updatedAt'), now)}d]\n    {p['url']}")
    for label, items in [
        ("Review requested from you", search("prs", "--owner", ORG, "--review-requested", user,
                                             "--state", "open", fields=PR_FIELDS)),
        ("Assigned to you", search("issues", "--owner", ORG, "--assignee", user, "--state", "open",
                                   "--include-prs")),
        ("Threads you're involved in with new activity", search("issues", "--owner", ORG, "--involves", user,
                                                               "--updated", window, "--include-prs")),
    ]:
        print(f"{label}: {len(items)}")
        for item in items[:20]:
            print(f"  [{repo_of(item)}] #{item['number']} {item['title']}  {item['url']}")


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=None)
    parser.add_argument("--user", default="@me", help="GitHub login for the personal sections")
    parser.add_argument("--no-me", action="store_true", help="skip the personal sections")
    args = parser.parse_args()

    try:
        subprocess.run(["gh", "--version"], capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        print("ERROR: the GitHub CLI (gh) is not installed.")
        sys.exit(1)

    now = datetime.now(timezone.utc)
    hours = args.hours or (72 if now.weekday() == 0 else 24)
    since = (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    window = f">={since}"
    print(f"WINDOW: last {hours}h, since {since} (generated {now:%Y-%m-%d %H:%M} UTC)")
    print(f"FOCUS REPOS (deep dive + contribution suggestions): {', '.join(FOCUS_REPOS)}")

    section_releases(since)
    bot_items = []
    bot_items += print_section("NEW ISSUES", search("issues", "--owner", ORG, "--created", window))
    bot_items += print_section("NEW PULL REQUESTS", search("prs", "--owner", ORG, "--created", window, fields=PR_FIELDS))
    bot_items += print_section("MERGED PULL REQUESTS", search("prs", "--owner", ORG, "--merged-at", window, fields=PR_FIELDS))
    print_section("CLOSED ISSUES", search("issues", "--owner", ORG, "--closed", window), with_body=False)

    print("\n== ONGOING DISCUSSIONS (older items updated in window) ==")
    for repo in DISCUSSION_REPOS:
        items = search("issues", "--repo", f"{ORG}/{repo}", "--updated", window, "--include-prs")
        older = [i for i in items if (i.get("createdAt") or "") < since and not is_bot(i)]
        if older:
            print(f"[{repo}]")
            for item in older:
                print(fmt_item(item, with_body=False))

    section_discussions(since)

    issues_by_repo = {r: open_issues(r) for r in FOCUS_REPOS}
    for repo in FOCUS_REPOS:
        section_focus_repo(repo, since, now, issues_by_repo[repo])
    section_parity(now)
    if not args.no_me:
        section_your_work(args.user, window, now)
    section_candidates(args.user, now, issues_by_repo)

    print("\n== BOT ACTIVITY IN WINDOW (counts only) ==")
    counts = Counter(repo_of(i) for i in bot_items)
    print("  " + (", ".join(f"{r}: {n}" for r, n in counts.most_common()) or "none"))

    if calls["ok"] == 0:
        print("\nERROR: every GitHub request failed. Check gh authentication "
              "(`gh auth login` locally; GH_TOKEN in GitHub Actions).")
    if warnings:
        print("\n== WARNINGS ==")
        for w in warnings:
            print("  " + w)


if __name__ == "__main__":
    main()