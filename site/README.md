# The Hiero Ledger

A static Next.js site that turns the daily briefings in `../briefings/*.md` into a newspaper-style front page with an archive.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to out/
```

Each `briefings/YYYY-MM-DD.md` (or `YYYY-MM-DD-<suffix>.md`) becomes an edition at `/editions/<slug>/`. The home page shows the newest edition, and `/archive/` lists all of them. The parser in `src/lib/briefings.ts` expects the structure the `hiero-daily-overview` skill writes: a `# ` title, a `**TL;DR**` list, and `## ` and `### ` sections.

The **repo lens** in the margin counts the GitHub links per repo. Click a repo to highlight every item that links to it. Repo labels and colours are defined in `src/lib/repos.ts`.

## Pulse (`/pulse/`)

An interactive dashboard built from data rather than the briefings. It covers every repo in the `hiero-ledger` and `LFDT-CLPR` orgs: every open issue and PR, plus everything closed or merged in the last 90 days. It has an org map, an activity heatmap, PR health, the issue backlog by age, flow, releases, contributors and labels. A filter row scopes every chart, and clicking a mark lists the items behind it.

The data comes from `scripts/fetch_pulse.py` (it needs `gh`, and takes about 5 minutes). The script writes `site/public/pulse/pulse.json`, which is git-ignored:

```bash
python3 ../scripts/fetch_pulse.py --user jexsie
```

The deploy workflow runs it before every build and on a daily schedule, so the published dashboard refreshes each morning.

Deployment runs from `.github/workflows/deploy-site.yml` on every push to `main` that touches `briefings/` or `site/`. That workflow sets `PAGES_BASE_PATH` so assets resolve under `/<repo>/`.
