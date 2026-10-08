---
name: hiero-daily-overview
description: Builds a daily (or weekly) Hiero briefing from hiero-ledger GitHub data — everything going on across the org (discussions, new ideas, HIPs, features, changes, deprecations, releases), a deep dive into the user's focus repos (JS SDK, TCK, Java SDK, Solo, Solo Action, JSON-RPC relay), the status of their own PRs and threads, and specific contribution suggestions in those focus repos. Use this skill whenever the user asks for their Hiero overview, digest, briefing or catch-up, asks what to work on or contribute to in Hiero, what's happening in any Hiero repo or discussion, which HIPs moved, or wants to review hiero-ledger issues and PRs — even if they don't say "overview".
---

# Hiero daily overview

The briefing has three jobs:

1. **Keep the user updated on everything going on in Hiero:** discussions, new ideas, proposals, HIPs, features being built, things changed, deprecated or removed, and releases, across the whole org.
2. **Show what is being worked on and what is still to be done** in the focus repos.
3. **Suggest specific contributions**, only in the focus repos, that the user could start on.

## Contributor profile

Use this to judge what fits. The user can edit it; prefer it over guesses.

- GitHub user: jexsie
- Focus repos: hiero-sdk-js, hiero-sdk-tck, hiero-sdk-java, solo, hiero-solo-action, hiero-json-rpc-relay
- Strengths: TypeScript and JavaScript; Java for the Java SDK
- Comfortable with: intermediate issues; open to larger HIP implementation work
- Interests: SDK features, TCK parity, HIP implementations, developer tooling (Solo, Solo Action), EVM compatibility (relay)

## Step 1: Get the data

All paths are relative to the repo root.

**In a cloud routine, read the prepared data file.** A GitHub Action in this repo (`.github/workflows/fetch-hiero-activity.yml`) runs the fetch script at 05:00 Kampala time on weekdays and commits the output to `data/YYYY-MM-DD.txt`. Read today's file, using today's date in Africa/Kampala time. Don't run the script, call the GitHub API, or clone hiero-ledger repos in this mode. Cloud sessions can only reach the repos attached to them, and a digest built from commit logs misses what matters most here (open issues, PRs, discussions, claims).

- If today's file is missing, use the newest file in `data/` and say at the top which date the data is from.
- If `data/` has no files at all, send a short message saying the GitHub Action hasn't produced data yet, with a link to the repo's Actions tab, and stop.

**Locally, run the script yourself with `--save`**, so the data lands in `data/` exactly as the GitHub Action would write it:

```bash
python3 .claude/skills/hiero-daily-overview/scripts/fetch_activity.py --save              # data/YYYY-MM-DD.txt, last 24h (72h on Mondays)
python3 .claude/skills/hiero-daily-overview/scripts/fetch_activity.py --save --hours 168  # data/YYYY-MM-DD-168h.txt, "this week"
```

The script prints the path it wrote (today's date in Kampala time) and a one-line summary. Then read that file. Don't redirect stdout or save the data anywhere else. A local run overwrites the file for that day, including one the Action already committed, so the briefing and its data always match. Don't commit the data file; leave that to the user, like the briefing.

Pick `--hours` from the request ("this week" → 168). If `gh` is missing or every request fails, tell the user how to fix it (`gh auth login`) and stop. Locally you can also read more about a promising item with `gh issue view <n> --repo hiero-ledger/<repo> --comments`.

If the data contains an ERROR line or a WARNINGS section, mention it at the top of the briefing so the reader knows something may be missing.

## Step 2: Understand the data

The file has these sections:

- **RELEASES, NEW ISSUES, NEW PULL REQUESTS, MERGED PULL REQUESTS, CLOSED ISSUES:** activity in the time window across the whole hiero-ledger org. Watchlist repos have longer excerpts; other repos have shorter ones.
- **ONGOING DISCUSSIONS:** older issues and PRs in the HIP and SDK-hub repos with new activity.
- **DISCUSSIONS:** GitHub Discussions created (NEW) or with new replies in the window, with category and an excerpt. New ideas often start here.
- **FOCUS REPO: \<repo\>** (one per focus repo): every open human PR with review state, age, idle days and size; open issues active in the last 30 days (assignee or UNASSIGNED, labels, milestone, comments; `NEW` marks issues created in the window); a summary of older open issues; open milestones; and the last 20 merges.
- **SDK PARITY:** human PRs merged in each SDK and the TCK over the last 30 days.
- **YOUR WORK:** the user's open PRs with review decision and latest reviews, review requests, assignments, and threads they're involved in that have new activity.
- **CONTRIBUTION CANDIDATES:** for each focus repo, the top unassigned, unblocked open issues. Each has a STATUS: `looks free`, `POSSIBLY CLAIMED by <user> <n>d ago` (someone asked to work on it in a comment), or `OPEN PR LINKED` (someone already has a PR). The last two comments are included.

## Step 3: Pick contribution suggestions

Suggest only work in the focus repos. Aim for one or two per focus repo where something good exists (about 5–8 in total), and skip a repo rather than padding it with weak picks.

- **Only suggest work that is actually available.** `OPEN PR LINKED` items are taken. A `POSSIBLY CLAIMED` item is taken if the claim is recent (about two weeks or less). An older claim with no linked PR can be suggested as "ask whether it's still being worked on", and say so explicitly.
- **Rank by** fit with the contributor profile, availability, maintainer signal (a help-wanted or skill label, or a maintainer comment inviting PRs), impact (HIP work, TCK or SDK parity, an upcoming milestone), and how much effort the size suggests.
- **Find parity gaps for the JS and Java SDKs.** Compare SDK PARITY with their focus-repo sections. If a feature or TCK method merged in two or more other SDKs and the JS or Java SDK has no matching merged PR, open PR or open issue, that's a strong suggestion. The first step is usually to open an issue that links the other SDKs' PRs as a reference.
- **Include a review suggestion when there is a good one.** Reviewing is a real contribution and keeps the user close to the codebase. Pick an open focus-repo PR that is ready (not draft), has no review decision, has been idle 3+ days, and is small enough to review in one sitting (roughly under 300 changed lines).

For each suggestion, write:

1. A plain description of the work, with the link.
2. Why it fits the user.
3. Its status: who opened it, how recent, any claim or maintainer comment.
4. A concrete first step. Examples: "comment asking to be assigned", "read the Java implementation in <link> as a reference", "check the TCK spec for the method".
5. A rough size, and what it's based on (label, scope, reference implementation).

## Step 4: Write the briefing

Use this structure, leaving out empty sections (except the TL;DR):

```markdown
# Hiero briefing — {weekday, date} ({window})

**TL;DR**

- 4–6 bullets: the most important news across Hiero, anything in YOUR WORK that needs action, and the best contribution opportunity.

## Your work

- PRs with changes requested or new review comments first, then PRs waiting for review (with idle days), then review requests, then threads with new replies.

## Where you can contribute

### JS SDK / TCK / Java SDK / Solo / Solo Action / JSON-RPC Relay

(the suggestions from Step 3, grouped under each focus repo that has any)

## Everything going on in Hiero

### Discussions & new ideas

- New GitHub Discussions, SDK-hub proposals, RFC/design issues, and active threads, with a line on what's being debated.

### HIP tracker

| HIP | Title | What happened |

### Being built

- Open feature work and cross-SDK rollouts (combine one HIP or feature across SDKs into one line showing each SDK's state).

### Shipped

- Releases first, then notable merged features.

### Changed

### Deprecated, removed, breaking

### Other repos

- Anything notable from repos not covered above (consensus node, CLI, explorer, governance and others).

## Focus repos

### {repo} (one block per focus repo)

- **In progress:** open PRs that matter, especially ready but unreviewed, changes requested and idle, or approved but not merged. Give a count of stale drafts rather than listing them.
- **To be done:** open issues grouped into themes that fit the data (e.g. HIP implementations, TCK, bugs, features and DX, docs, deprecations), with a count per theme and the 1–3 most notable items. Flag unassigned ones and what's in the next milestone.
- **Recently shipped:** what recent merges changed for users.
- **Parity gaps** (JS and Java SDKs only): features or TCK methods landed elsewhere but missing here.

## Background

One line, e.g. "Also: 9 bug fixes, 31 dependency bumps, 14 good-first-issues across 6 repos."
```

The user wants to know about anything going on, so it's fine for "Everything going on" to be long. Still keep each item to one line, and put the most important items first in each section.

**How to classify activity:** new HIPs, SDK-hub issues, discussions and proposal/RFC/design items are **new ideas**; open `feat:` or HIP-referencing PRs are **being built**; merged features and releases are **shipped**; `refactor`/`perf` or changes to defaults, config, APIs or CLI flags are **changes**; `!`, BREAKING CHANGE, deprecate, remove, drop support, rename or migrate are **deprecations and breaking changes**. Bug fixes, tests, CI, docs, dependency bumps and beginner issues go in the background count unless they change behavior.

**How to write each line:**

- Always use full links. Issues and PRs: `https://github.com/hiero-ledger/<repo>/issues/<number>` (this also works for PRs). Discussions: use the URL from the data. Never write a bare `#123`, because GitHub and Slack link bare numbers to whatever repo the message is shown in.
- Start with the short repo name in bold: **JS SDK**, **Java SDK**, **Go SDK**, **Python SDK**, **Rust SDK**, **C++ SDK**, **Swift SDK**, **TCK**, **HIPs**, **SDK hub**, **Solo**, **Solo Action**, **Relay**, **Mirror Node**, **Block Node**, **Consensus Node**. For other repos, use the repo name.
- Rewrite titles in plain words that say what changes and why it matters.
- Don't invent detail. If the title and excerpt don't make something clear, say "details unclear from the title".

## Delivering the briefing

**When running locally, always save the briefing to a file** as well as showing it in chat, so past briefings stay easy to look back on. To tell where you are running, check `CLAUDE_CODE_REMOTE`: it is `true` in cloud sessions and unset locally.

1. Write the full briefing to `briefings/YYYY-MM-DD.md` at the repo root, using today's date in Africa/Kampala time. If the user asked for a different window (for example "this week"), add it to the name, e.g. `briefings/2026-10-06-week.md`. Overwrite the file if it already exists for that day.
2. Briefings are committed and published. When `briefings/` changes on `main`, `.github/workflows/deploy-site.yml` rebuilds the public GitHub Pages site in `site/`. Don't commit or push the file yourself unless the user asks. Remember that anything in a briefing becomes public once it's pushed.
3. Keep the structure from Step 4, because the site parses it. The `# ` title ends with the window in parentheses, the TL;DR is a `**TL;DR**` line followed by `- ` bullets, sections are `## `, and subsections are `### `. In "Where you can contribute", each suggestion is a numbered item.
4. Use markdown links with full URLs in the file, e.g. `[Solo Action #84](https://github.com/hiero-ledger/hiero-solo-action/issues/84)`, so every item is clickable and the site can tag it by repo.
5. After saving, tell the user the file path in one line.

**In a cloud routine, don't write or commit files**, because the routine is read-only. Deliver where the routine prompt says. In Slack, send the briefing as three messages so each stays readable:

1. TL;DR, your work, and where you can contribute
2. Everything going on in Hiero
3. Focus repos and background

If nothing says where to deliver, reply in chat.

## Customizing

The lists at the top of `.claude/skills/hiero-daily-overview/scripts/fetch_activity.py` control the watchlist, the focus repos (`FOCUS_REPOS`), and the parity comparison. Edit them rather than adding special cases here. Update the contributor profile above when the user's skills or interests change.
