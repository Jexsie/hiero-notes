"use client";

import { DAY, compact, openAt, type Issue, type Item, type Pr, type Repo } from "@/lib/pulse/model";
import { useTooltip } from "./ui";

type Props = {
  issues: Issue[];
  prs: Pr[];
  repos: Repo[];
  now: number;
  windowDays: number;
  onDrill: (title: string, items: Item[]) => void;
};

function Spark({ values, kind }: { values: number[]; kind: "line" | "bars" }) {
  const w = 96;
  const h = 28;
  const max = Math.max(1, ...values);
  const min = kind === "line" ? Math.min(...values) : 0;
  const span = Math.max(1, max - min);
  const x = (i: number) => (values.length < 2 ? w : (i / (values.length - 1)) * (w - 4) + 2);
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  if (kind === "bars") {
    const bw = Math.max(2, w / values.length - 2);
    return (
      <svg width={w} height={h} aria-hidden className="overflow-visible">
        {values.map((v, i) => (
          <rect
            key={i}
            x={(i * w) / values.length}
            y={h - Math.max(1, (v / max) * (h - 2))}
            width={bw}
            height={Math.max(1, (v / max) * (h - 2))}
            rx={1.5}
            fill={i === values.length - 1 ? "var(--s1)" : "var(--muted)"}
            opacity={i === values.length - 1 ? 1 : 0.45}
          />
        ))}
      </svg>
    );
  }
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1) ?? 0)} r={4} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

export function Kpis({ issues, prs, repos, now, windowDays, onDrill }: Props) {
  const { show, hide } = useTooltip();
  const start = now - windowDays * DAY;
  const step = windowDays > 30 ? 7 : 3;
  const ticks: number[] = [];
  for (let t = start + step * DAY; t < now; t += step * DAY) ticks.push(t);
  ticks.push(now);

  const openIssues = issues.filter((i) => !i.closed);
  const openPrs = prs.filter((p) => !p.closed);
  const merged = prs.filter((p) => p.merged && p.merged >= start);
  const waiting = openPrs.filter((p) => !p.draft && p.review === "waiting");
  const idleWaiting = waiting.filter((p) => now - p.updated > 14 * DAY);
  const unassigned = openIssues.filter((i) => i.assignees.length === 0);
  const releases = repos.flatMap((r) => r.releases.filter((x) => x.at >= start).map((x) => ({ ...x, repo: r })));

  const binned = (times: number[]) =>
    ticks.map((t) => times.filter((x) => x <= t && x > t - step * DAY).length);

  const issuesThen = openAt(issues, start);
  const prsThen = openAt(prs, start);

  const tiles = [
    {
      label: "Open issues",
      value: openIssues.length,
      sub: delta(openIssues.length - issuesThen, windowDays),
      spark: <Spark kind="line" values={ticks.map((t) => openAt(issues, t))} />,
      items: openIssues,
    },
    {
      label: "Open pull requests",
      value: openPrs.length,
      sub: delta(openPrs.length - prsThen, windowDays),
      spark: <Spark kind="line" values={ticks.map((t) => openAt(prs, t))} />,
      items: openPrs,
    },
    {
      label: `Merged · ${windowDays}d`,
      value: merged.length,
      sub: `${(merged.length / (windowDays / 7)).toFixed(0)} a week`,
      spark: <Spark kind="bars" values={binned(merged.map((p) => p.merged!))} />,
      items: merged,
    },
    {
      label: "Waiting for review",
      value: waiting.length,
      sub: `${idleWaiting.length} idle over 2 weeks`,
      spark: null,
      items: waiting,
    },
    {
      label: "Unassigned issues",
      value: unassigned.length,
      sub: `${openIssues.length ? Math.round((unassigned.length / openIssues.length) * 100) : 0}% of open`,
      spark: null,
      items: unassigned,
    },
    {
      label: `Releases · ${windowDays}d`,
      value: releases.length,
      sub: releases.length
        ? `latest ${[...releases].sort((a, b) => b.at - a.at)[0].repo.short}`
        : "none",
      spark: <Spark kind="bars" values={binned(releases.map((r) => r.at))} />,
      items: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        <button
          key={t.label}
          type="button"
          disabled={!t.items}
          onClick={() => t.items && onDrill(t.label, t.items as Item[])}
          onPointerMove={(e) => t.items && show(e, <span className="k">Click to list all {t.value}</span>)}
          onPointerLeave={hide}
          className="card rise flex flex-col items-start gap-1 p-4 text-left transition-shadow enabled:hover:shadow-[0_0_0_1px_var(--ink)]"
          style={{ "--d": `${i * 40}ms` } as React.CSSProperties}
        >
          <span className="text-[0.78rem] text-[var(--ink-2)]">{t.label}</span>
          <span className="flex w-full items-end justify-between gap-2">
            <span className="text-[1.9rem] font-semibold leading-none">{compact(t.value)}</span>
            <span className="hidden sm:block">{t.spark}</span>
          </span>
          <span className="truncate text-[0.75rem] text-[var(--ink-2)]">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

function delta(d: number, days: number) {
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "■";
  return `${arrow} ${d > 0 ? "+" : ""}${d} vs ${days}d ago`;
}
