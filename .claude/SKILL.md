---
name: hiero-daily-overview
description: Builds a daily (or weekly) digest of what is moving in the Hiero project on GitHub (hiero-ledger org) — new ideas and proposals, HIP status changes, features being implemented, things changed, deprecated or removed, and releases — across the SDKs (Java, JS, Go, Python, Rust, C++, Swift), sdk-collaboration-hub, hiero-improvement-proposals, hiero-sdk-tck, solo, hiero-solo-action, mirror node, block node and the rest of the org. Use this skill whenever the user asks for their Hiero overview, update, digest, briefing or catch-up, asks "what's new in Hiero", what happened in the SDKs, solo, mirror node or block node, which HIPs moved, or wants to review hiero-ledger issues and PRs — even if they don't say "overview".
---

# Hiero daily overview

The reader wants to follow the *direction* of the Hiero project: which ideas are being proposed, what is planned, what is being built, what shipped, and what is changing or going away. This is not a full activity log. Bug fixes, tests, CI, dependency bumps and beginner issues are background unless they change behavior, so they get counted rather than listed. A good digest lets the reader understand the day in two or three minutes and click through to anything they want to follow.

## Step 1: Collect the data

Run the bundled script from this skill's directory:

```bash
python3 scripts/fetch_activity.py            # last 24h (72h on Mondays)
python3 scripts/fetch_activity.py --hours 168  # "this week"
```

Pick `--hours` from the request: "since yesterday" → default, "this week" → 168, "since Friday" → count the hours. Add `--no-me` if the user only wants project news.

The script searches the whole hiero-ledger org, so new or unlisted repos are included automatically. It prints sections for releases, new issues, new PRs, merged PRs, closed issues, older HIP and SDK-hub discussions that were active in the window, bot counts, the user's own queue, and any warnings. Watchlist repos get title, labels and a body excerpt; other repos get titles only.

If the script says `gh` is not authenticated or not installed, stop and tell the user how to fix it (`gh auth login`, or a `GH_TOKEN` variable in a routine environment). Never fill a digest with guessed activity. If the output has a WARNINGS section, mention it in the digest footer so the reader knows the data may be incomplete.

When a title is vague but the item looks significant (HIP-related, labeled breaking, touching several SDKs), read more with `gh pr view <n> --repo hiero-ledger/<repo> --json title,body,files` or `gh issue view`. Do this for at most about ten items, choosing the ones most likely to matter.

## Step 2: Classify each human item

Put each item into exactly one category. Labels, the conventional-commit prefix in PR titles, and wording are the main signals.

| Category | Typical signals |
|---|---|
| New idea / proposal | New issues or PRs in hiero-improvement-proposals or sdk-collaboration-hub; labels like enhancement, feature, proposal, RFC, design, discussion; titles starting with "Proposal", "RFC", "Design", "Idea", "Should we" |
| Being implemented | Open PRs with `feat:` or that reference a HIP (`HIP-1234`) or a feature issue |
| Shipped | Merged `feat:` PRs and releases |
| Changed | `refactor:`/`perf:` PRs or anything that changes defaults, configuration, public API signatures, CLI flags, protobuf/HAPI versions or observable behavior |
| Deprecated, removed, breaking | `!` after the type (`feat!:`), "BREAKING CHANGE", breaking labels, or words like deprecate, remove, drop support, delete, sunset, rename, migrate |
| Background | Bug fixes, tests, CI, docs, chores, dependency bumps, good-first-issue tasks. Count these unless one reveals something above, such as a fix that changes behavior or docs for a new feature |

Look for patterns across repos. When the same HIP or feature shows up in several SDK repos, or in the TCK and SDKs together, it is a coordinated rollout. Combine it into one line showing each SDK's state, for example "HIP-1234 (batch transactions): Java merged, JS PR open, Go and Python issue only, TCK tests open". These lines are often the most useful part of the digest because they show where the project is heading as a whole.

For HIPs, report any visible status transition (for example into Last Call, Accepted, Final, or Rejected), new HIP drafts, and HIPs with heavy discussion in the window. If a status change is not clear from the title, read the PR's changed files to see the new `status:` value before reporting it.

Repos outside the watchlist (consensus node, JSON-RPC relay, CLI, and others) can be very busy. From those, include only new proposals, HIP-related work, deprecations or breaking changes, and releases.

## Step 3: Write the digest

Use this structure, and leave out any section that is empty (except TL;DR):

```markdown
# Hiero overview — {weekday, date} ({window, e.g. "last 24h"})

**TL;DR**
- 3–5 bullets with the direction-level news. If nothing notable happened, say it was a quiet day.

## New ideas & proposals
## HIP tracker
| HIP | Title | What happened |
## Cross-SDK rollouts
## In progress
## Shipped
(releases first, then notable merged features)
## Changed
## Deprecated, removed, breaking
## Your queue
## Background
One line, e.g. "Also: 9 bug fixes, 31 dependency bumps, 14 good-first-issues across 6 repos."
```

How to write each line:

- Start with the short repo name in bold: **Java SDK**, **JS SDK**, **Go SDK**, **Python SDK**, **Rust SDK**, **C++ SDK**, **Swift SDK**, **TCK**, **HIPs**, **SDK hub**, **Solo**, **Solo Action**, **Mirror Node**, **Block Node**, **Consensus Node**, **Relay**. For other repos, use the repo name.
- Rewrite the title in plain words that say what changes and why it matters, then add the link. For example, "**Solo** — new `--dev` flag to start a single-node network in one command ([#123](url))" is more useful than repeating "feat: add dev mode".
- Don't invent impact. If the title and excerpt don't make it clear, say "details unclear from the title" so the reader knows to click through.
- Show the queue under "Your queue" only. Don't repeat those items elsewhere unless they also belong in one of the news sections.

## Delivering the digest

If the user or the routine prompt says where to deliver it (a Slack DM, a file, a GitHub issue), deliver it there. If nothing is said, reply in chat. When saving to a file, use `hiero-overview/YYYY-MM-DD.md` so that past days stay easy to compare.

## Customizing

The watchlist, the repos checked for releases, and the bot/noise filters are constants at the top of `scripts/fetch_activity.py`. When the user wants to follow a different set of repos, edit those lists rather than adding special cases to these instructions.
