"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FOCUS, GROUPS, decode, fmtAge, type GroupKey, type Item, type Pulse, type RawPulse } from "@/lib/pulse/model";
import { ThemeToggle } from "../ThemeToggle";
import { Backlog } from "./Backlog";
import { Contributors } from "./Contributors";
import { Drawer } from "./Drawer";
import { Flow } from "./Flow";
import { Heatmap } from "./Heatmap";
import { Kpis } from "./Kpis";
import { Labels } from "./Labels";
import { OrgMap } from "./OrgMap";
import { PrHealth } from "./PrHealth";
import { Radar } from "./Radar";
import { Releases } from "./Releases";
import { GROUP_COLOR, Seg, TooltipProvider } from "./ui";

type Scope = "all" | "focus" | GroupKey;

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function PulseApp() {
  const [data, setData] = useState<Pulse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [repo, setRepo] = useState<number | null>(null);
  const [windowDays, setWindowDays] = useState<30 | 90>(90);
  const [bots, setBots] = useState(false);
  const [drill, setDrill] = useState<{ title: string; items: Item[] } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/pulse/pulse.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RawPulse>;
      })
      .then((raw) => setData(decode(raw)))
      .catch((e) => setError(String(e)));
  }, []);

  const onDrill = useCallback((title: string, items: Item[]) => setDrill({ title, items }), []);
  const closeDrill = useCallback(() => setDrill(null), []);

  const view = useMemo(() => {
    if (!data) return null;
    const inScope = data.repos.filter((r) =>
      scope === "all" ? true : scope === "focus" ? FOCUS.has(r.id) : r.group === scope,
    );
    const repos = repo !== null ? inScope.filter((r) => r.i === repo) : inScope;
    const scopeIds = new Set(inScope.map((r) => r.i));
    const scopeIssues = data.issues.filter((x) => scopeIds.has(x.repo) && (bots || !x.bot));
    const scopePrs = data.prs.filter((x) => scopeIds.has(x.repo) && (bots || !x.bot));
    const inRepo = <T extends Item>(x: T) => repo === null || x.repo === repo;
    return {
      inScope,
      repos,
      scopeIssues,
      scopePrs,
      issues: scopeIssues.filter(inRepo),
      prs: scopePrs.filter(inRepo),
    };
  }, [data, scope, repo, bots]);

  if (error) {
    return (
      <Shell>
        <div className="card mx-auto mt-16 max-w-lg p-6 text-center">
          <p className="font-semibold">No data yet</p>
          <p className="mt-2 text-[var(--ink-2)]">
            Couldn&rsquo;t load <code>pulse/pulse.json</code> ({error}). Run{" "}
            <code>python3 scripts/fetch_pulse.py</code> from the repo root, then reload.
          </p>
        </div>
      </Shell>
    );
  }
  if (!data || !view) {
    return (
      <Shell>
        <p className="mt-24 text-center text-[var(--ink-2)]">Loading activity…</p>
      </Shell>
    );
  }

  const now = data.generatedAt;
  const selectRepo = (i: number | null) => setRepo(i);
  const scopes: { value: Scope; label: string; color?: string }[] = [
    { value: "all", label: "All repos" },
    { value: "focus", label: "Your focus repos" },
    ...GROUPS.map((g) => ({ value: g.key as Scope, label: g.label, color: GROUP_COLOR[g.key] })),
  ];
  const selected = repo !== null ? data.repos[repo] : null;

  return (
    <Shell generated={now}>
      {/* Filters scope everything below them */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[var(--ring)] bg-[color-mix(in_srgb,var(--plane)_92%,transparent)] px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {scopes.map((s) => (
              <button
                key={s.value}
                type="button"
                className="pill"
                aria-pressed={scope === s.value}
                onClick={() => {
                  setScope(s.value);
                  setRepo(null);
                }}
              >
                {s.color && <span className="swatch" style={{ background: s.color }} />}
                {s.label}
              </button>
            ))}
          </div>
          <select
            value={repo ?? ""}
            onChange={(e) => setRepo(e.target.value === "" ? null : Number(e.target.value))}
            className="pill min-w-0 max-w-full appearance-auto"
            aria-label="Repository"
          >
            <option value="">Every repo in scope ({view.inScope.length})</option>
            {[...view.inScope]
              .sort((a, b) => a.short.localeCompare(b.short))
              .map((r) => (
                <option key={r.id} value={r.i}>
                  {r.short} ({r.org === "hiero-ledger" ? r.name : r.id})
                </option>
              ))}
          </select>
          <div className="ml-auto flex items-center gap-3">
            <Seg
              label="Time window"
              value={windowDays}
              onChange={setWindowDays}
              options={[
                { value: 30, label: "30 days" },
                { value: 90, label: "90 days" },
              ]}
            />
            <label className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-2)]">
              <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} />
              Include bots
            </label>
          </div>
        </div>
        {selected && (
          <div className="mt-2 flex items-center gap-2 text-[0.85rem]">
            <span className="swatch" style={{ background: GROUP_COLOR[selected.group] }} />
            <a href={selected.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
              {selected.id}
            </a>
            <span className="truncate text-[var(--ink-2)]">
              {selected.description} · {selected.language ?? "—"} · pushed {fmtAge(now - selected.pushed)} ago
            </span>
            <button type="button" className="pill ml-auto" onClick={() => setRepo(null)}>
              ✕ Show all
            </button>
          </div>
        )}
      </div>

      <Kpis issues={view.issues} prs={view.prs} repos={view.repos} now={now} windowDays={windowDays} onDrill={onDrill} />

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <OrgMap
            repos={view.inScope}
            issues={view.scopeIssues}
            prs={view.scopePrs}
            now={now}
            windowDays={windowDays}
            selected={repo}
            onSelect={selectRepo}
            delay={120}
          />
        </div>
        <div className="xl:col-span-4">
          <Radar user={data.user} repos={data.repos} issues={data.issues} prs={data.prs} now={now} windowDays={windowDays} delay={160} />
        </div>
        <div className="xl:col-span-12">
          <Heatmap
            repos={view.inScope}
            issues={view.scopeIssues}
            prs={view.scopePrs}
            now={now}
            windowDays={windowDays}
            selected={repo}
            onSelect={selectRepo}
            onDrill={onDrill}
            delay={200}
          />
        </div>
        <div className="xl:col-span-7">
          <PrHealth prs={view.prs} repos={data.repos} now={now} user={data.user} onDrill={onDrill} delay={240} />
        </div>
        <div className="xl:col-span-5">
          <Backlog repos={view.inScope} issues={view.scopeIssues} now={now} selected={repo} onSelect={selectRepo} onDrill={onDrill} delay={280} />
        </div>
        <div className="xl:col-span-6">
          <Flow issues={view.issues} prs={view.prs} now={now} windowDays={windowDays} onDrill={onDrill} delay={320} />
        </div>
        <div className="xl:col-span-6">
          <Releases repos={view.repos} now={now} windowDays={windowDays} delay={360} />
        </div>
        <div className="xl:col-span-6">
          <Contributors prs={view.prs} now={now} windowDays={windowDays} user={data.user} onDrill={onDrill} delay={400} />
        </div>
        <div className="xl:col-span-6">
          <Labels issues={view.issues} onDrill={onDrill} delay={440} />
        </div>
      </div>
      <Sources data={data} />

      {drill && <Drawer title={drill.title} items={drill.items} repos={data.repos} now={now} onClose={closeDrill} />}
    </Shell>
  );
}

function Sources({ data }: { data: Pulse }) {
  const orgs = [...new Set(data.repos.map((r) => r.org))];
  return (
    <footer className="mt-6 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[0.78rem] text-[var(--ink-2)]">
      <div>
        <p>
          {data.repos.length} repos across {orgs.map((o, i) => (
            <span key={o}>
              {i > 0 && " and "}
              <a href={`https://github.com/${o}`} target="_blank" rel="noreferrer" className="underline">
                {o}
              </a>
            </span>
          ))}
          : every open issue and PR, plus everything closed or merged in the last {data.windowDays} days. History lines
          are rebuilt from created and closed dates.
        </p>
      </div>
      <p className="text-[var(--muted)]">
        Generated {new Date(data.generatedAt).toUTCString().replace(":00 GMT", " UTC")} by scripts/fetch_pulse.py ·{" "}
        {data.issues.length.toLocaleString()} issues · {data.prs.length.toLocaleString()} PRs
      </p>
    </footer>
  );
}

function Shell({ children, generated }: { children: React.ReactNode; generated?: number }) {
  return (
    <TooltipProvider>
      <div className="pulse">
        <header className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 pt-4 sm:px-6">
          <h1 className="text-[1.25rem] font-semibold tracking-tight">
            Hiero <span className="text-[var(--s1)]">Pulse</span>
          </h1>
          {generated && (
            <span className="hidden text-[0.78rem] text-[var(--ink-2)] sm:inline">
              data from {new Date(generated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
            </span>
          )}
          <nav className="ml-auto flex items-center gap-4 text-[0.82rem] text-[var(--ink-2)]">
            <Link href="/" className="hover:text-[var(--ink)]">Ledger</Link>
            <Link href="/v2/" className="hover:text-[var(--ink)]">Signal</Link>
            <ThemeToggle light="Dark" dark="Light" suffix="" className="hover:text-[var(--ink)]" />
          </nav>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-2 sm:px-6">{children}</main>
      </div>
    </TooltipProvider>
  );
}

