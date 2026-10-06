#!/usr/bin/env python3
"""Collect hiero-ledger GitHub activity for a time window, as compact text.

Usage (from the repo root):
    python3 .claude/scripts/fetch_activity.py               # last 24h (72h on Mondays)
    python3 .claude/scripts/fetch_activity.py --hours 168   # last week
    python3 .claude/scripts/fetch_activity.py --user jexsie # queue for a named user
    python3 .claude/scripts/fetch_activity.py --no-me       # skip the "your queue" section

In GitHub Actions, pass --user: there `@me` would mean the Actions bot, not you.

Requires the GitHub CLI (gh), authenticated via `gh auth login` or a GH_TOKEN env var.
Edit WATCHLIST below to change which repos get full detail.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ORG = "hiero-ledger"

# Full detail: every human issue/PR is listed. Order = order in the output.
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
]

# Repos where long-running discussions matter, so items *updated* in the window are shown too.
DISCUSSION_REPOS = ["hiero-improvement-proposals", "sdk-collaboration-hub"]

# Releases are checked for these repos (watchlist + a few important others).
RELEASE_REPOS = WATCHLIST + [
    "hiero-consensus-node",
    "hiero-json-rpc-relay",
    "hiero-cli",
    "hiero-enterprise-java",
    "hiero-mirror-node-explorer",
]

BOT_RE = re.compile(r"dependabot|renovate|github-actions|\[bot\]|step-security|^app/", re.I)
LOW_SIGNAL_LABEL_RE = re.compile(r"good.first.issue|beginner", re.I)

ITEM_FIELDS = "number,title,url,author,labels,repository,createdAt,body,state,commentsCount"
PR_FIELDS = ITEM_FIELDS + ",isDraft"
LIMIT = 300
EXCERPT_CHARS = 300

warnings = []
calls = {"ok": 0}


def gh(args):
    proc = subprocess.run(["gh", *args], capture_output=True, text=True)
    if proc.returncode == 0:
        calls["ok"] += 1
    if proc.returncode != 0:
        warnings.append(f"`gh {' '.join(args[:4])} ...` failed: {proc.stderr.strip()[:200]}")
        return []
    try:
        data = json.loads(proc.stdout or "[]")
    except json.JSONDecodeError:
        warnings.append(f"`gh {' '.join(args[:4])} ...` returned non-JSON output")
        return []
    if isinstance(data, list) and len(data) >= LIMIT:
        warnings.append(f"`gh {' '.join(args[:4])} ...` hit the {LIMIT}-item limit; results are incomplete")
    return data


def search(kind, *qualifiers, fields=ITEM_FIELDS):
    return gh(["search", kind, *qualifiers, "--limit", str(LIMIT), "--json", fields])


def repo_of(item):
    return item.get("repository", {}).get("name", "?")


def author_of(item):
    return (item.get("author") or {}).get("login", "?")


def is_bot(item):
    return bool(BOT_RE.search(author_of(item)))


def labels_of(item):
    return [l.get("name", "") for l in item.get("labels", [])]


def is_low_signal(item):
    return any(LOW_SIGNAL_LABEL_RE.search(l) for l in labels_of(item))


def excerpt(body):
    body = re.sub(r"<!--.*?-->", " ", body or "", flags=re.S)
    body = re.sub(r"\s+", " ", body).strip()
    return body[:EXCERPT_CHARS] + ("…" if len(body) > EXCERPT_CHARS else "")


def fmt_item(item, with_body=True):
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
        ex = excerpt(item.get("body"))
        if ex:
            out += f"\n    > {ex}"
    return out


def repo_order(repo):
    return (0, WATCHLIST.index(repo)) if repo in WATCHLIST else (1, repo)


def print_section(title, items, with_body=True):
    """Prints human items grouped by repo. Returns bot-authored items for the noise count."""
    humans = [i for i in items if not is_bot(i)]
    bots = [i for i in items if is_bot(i)]
    print(f"\n== {title} ({len(humans)} human, {len(bots)} bot) ==")
    by_repo = defaultdict(list)
    for item in humans:
        by_repo[repo_of(item)].append(item)
    for repo in sorted(by_repo, key=repo_order):
        group = by_repo[repo]
        tag = "watchlist" if repo in WATCHLIST else "other"
        low = [i for i in group if is_low_signal(i)]
        normal = [i for i in group if not is_low_signal(i)]
        print(f"[{repo}] ({tag})")
        for item in normal:
            print(fmt_item(item, with_body=with_body and repo in WATCHLIST))
        if low:
            print(f"  + {len(low)} good-first-issue/beginner items: "
                  + "; ".join(f"#{i['number']} {i['title']}" for i in low[:15])
                  + (" …" if len(low) > 15 else ""))
    return bots


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=None)
    parser.add_argument("--no-me", action="store_true", help="skip the personal queue section")
    parser.add_argument("--user", default="@me",
                        help="GitHub login for the queue section (default: the authenticated user)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    hours = args.hours or (72 if now.weekday() == 0 else 24)
    since_dt = now - timedelta(hours=hours)
    since = since_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    window = f">={since}"

    # No `gh auth status` pre-check: in cloud sessions a proxy authenticates gh, and the
    # check can fail even though API calls work. Failures are reported per call instead.
    try:
        subprocess.run(["gh", "--version"], capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        print("ERROR: the GitHub CLI (gh) is not installed.")
        sys.exit(1)

    print(f"WINDOW: last {hours}h, since {since} (now {now:%Y-%m-%d %H:%M} UTC)")

    # Releases
    print("\n== RELEASES ==")
    any_release = False
    for repo in RELEASE_REPOS:
        # REST, not `gh release list`: that uses GraphQL, which the cloud GitHub proxy blocks.
        for rel in gh(["api", f"repos/{ORG}/{repo}/releases?per_page=10"]):
            published = rel.get("published_at") or ""
            if rel.get("draft") or not published or published < since:
                continue
            any_release = True
            pre = " (pre-release)" if rel.get("prerelease") else ""
            print(f"  [{repo}] {rel.get('tag_name')}{pre} {published[:10]}  {rel.get('html_url')}")
    if not any_release:
        print("  none")

    bot_items = []
    bot_items += print_section("NEW ISSUES", search("issues", "--owner", ORG, "--created", window))
    bot_items += print_section("NEW PULL REQUESTS", search("prs", "--owner", ORG, "--created", window, fields=PR_FIELDS))
    bot_items += print_section("MERGED PULL REQUESTS", search("prs", "--owner", ORG, "--merged-at", window, fields=PR_FIELDS))
    print_section("CLOSED ISSUES", search("issues", "--owner", ORG, "--closed", window), with_body=False)

    # Ongoing discussions in HIP and SDK hub repos (items created earlier but updated in window)
    print("\n== ONGOING DISCUSSIONS (older items updated in window) ==")
    for repo in DISCUSSION_REPOS:
        items = search("issues", "--repo", f"{ORG}/{repo}", "--updated", window, "--include-prs",
                       fields=ITEM_FIELDS)
        older = [i for i in items if (i.get("createdAt") or "") < since and not is_bot(i)]
        if older:
            print(f"[{repo}]")
            for item in older:
                print(fmt_item(item, with_body=False))
    # Bot noise
    print("\n== BOT ACTIVITY (counts only) ==")
    counts = Counter(repo_of(i) for i in bot_items)
    print("  " + (", ".join(f"{r}: {n}" for r, n in counts.most_common()) or "none"))

    if not args.no_me:
        print(f"\n== YOUR QUEUE ({args.user}) ==")
        for label, items in [
            ("Review requested from you", search("prs", "--owner", ORG, "--review-requested", args.user,
                                                 "--state", "open", fields=PR_FIELDS)),
            ("Assigned to you", search("issues", "--owner", ORG, "--assignee", args.user, "--state", "open",
                                       "--include-prs")),
            ("Mentioned you in window", search("issues", "--owner", ORG, "--mentions", args.user,
                                               "--updated", window, "--include-prs")),
        ]:
            print(f"{label}: {len(items)}")
            for item in items[:20]:
                print(f"  [{repo_of(item)}] #{item['number']} {item['title']}  {item['url']}")

    if calls["ok"] == 0:
        print("\nERROR: every GitHub request failed. Check gh authentication "
              "(`gh auth login` locally; in a cloud routine, the GitHub connection).")
    if warnings:
        print("\n== WARNINGS ==")
        for w in warnings:
            print("  " + w)


if __name__ == "__main__":
    main()