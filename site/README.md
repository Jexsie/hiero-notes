# The Hiero Ledger

A static Next.js site that turns the daily briefings in `../briefings/*.md` into a newspaper-style front page with an archive.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to out/
```

Each `briefings/YYYY-MM-DD.md` (or `YYYY-MM-DD-<suffix>.md`) becomes an edition at `/editions/<slug>/`. The home page shows the newest edition, and `/archive/` lists all of them. The parser in `src/lib/briefings.ts` expects the structure the `hiero-daily-overview` skill writes: a `# ` title, a `**TL;DR**` list, and `## ` and `### ` sections.

The **repo lens** in the margin counts the GitHub links per repo. Click a repo to highlight every item that links to it. Repo labels and colours are defined in `src/lib/repos.ts`.

Deployment runs from `.github/workflows/deploy-site.yml` on every push to `main` that touches `briefings/` or `site/`. That workflow sets `PAGES_BASE_PATH` so assets resolve under `/<repo>/`.
