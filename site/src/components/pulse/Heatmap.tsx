"use client";

import { useState } from "react";
import { DAY, fmtDate, type Issue, type Item, type Pr, type Repo } from "@/lib/pulse/model";
import { Card, GROUP_COLOR, Seg, TipBody, useTooltip, useWidth } from "./ui";

type Metric = "merged" | "opened" | "closed";

const METRICS: { value: Metric; label: string; noun: string }[] = [
  { value: "merged", label: "PRs merged", noun: "PRs merged" },
  { value: "opened", label: "Issues opened", noun: "issues opened" },
  { value: "closed", label: "Issues closed", noun: "issues closed" },
];

/** Count buckets: 0 | 1 | 2–3 | 4–7 | 8–15 | 16+ */
const BUCKETS = [1, 2, 4, 8, 16];
const FILLS = ["var(--h1)", "var(--h2)", "var(--h3)", "var(--h4)", "var(--h5)"];
const LEGEND = ["1", "2–3", "4–7", "8–15", "16+"];

function fill(n: number) {
  if (n === 0) return "var(--surface-2)";
  let i = 0;
  while (i < BUCKETS.length - 1 && n >= BUCKETS[i + 1]) i++;
  return FILLS[i];
}

export function Heatmap({
  repos,
  issues,
  prs,
  now,
  windowDays,
  selected,
  onSelect,
  onDrill,
  delay,
}: {
  repos: Repo[];
  issues: Issue[];
  prs: Pr[];
  now: number;
  windowDays: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [metric, setMetric] = useState<Metric>("merged");
  const [expanded, setExpanded] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();

  // Align columns to whole UTC days ending today.
  const end = Math.floor(now / DAY) * DAY + DAY;
  const start = end - windowDays * DAY;
  const events: { repo: number; at: number; item: Item }[] =
    metric === "merged"
      ? prs.filter((p) => p.merged && p.merged >= start).map((p) => ({ repo: p.repo, at: p.merged!, item: p }))
      : metric === "opened"
        ? issues.filter((i) => i.created >= start).map((i) => ({ repo: i.repo, at: i.created, item: i }))
        : issues.filter((i) => i.closed && i.closed >= start).map((i) => ({ repo: i.repo, at: i.closed!, item: i }));

  const grid = new Map<number, Item[][]>();
  for (const e of events) {
    let row = grid.get(e.repo);
    if (!row) grid.set(e.repo, (row = Array.from({ length: windowDays }, () => [])));
    const d = Math.floor((e.at - start) / DAY);
    if (d >= 0 && d < windowDays) row[d].push(e.item);
  }
  const rows = repos
    .filter((r) => grid.has(r.i))
    .map((r) => ({ repo: r, cells: grid.get(r.i)!, total: grid.get(r.i)!.reduce((n, c) => n + c.length, 0) }))
    .sort((a, b) => b.total - a.total);
  const shown = expanded ? rows : rows.slice(0, 14);

  const labelW = 112;
  const totalW = 40;
  const cell = width ? Math.max(3, Math.floor((width - labelW - totalW) / windowDays)) : 0;
  const gap = cell >= 7 ? 2 : 1;
  const rowH = Math.max(10, Math.min(16, cell));
  const top = 18;
  const svgW = Math.max(width, labelW + totalW + windowDays * cell);
  const noun = METRICS.find((m) => m.value === metric)!.noun;

  const months: { x: number; label: string }[] = [];
  for (let d = 0; d < windowDays; d++) {
    const date = new Date(start + d * DAY);
    if (date.getUTCDate() === 1 || d === 0)
      months.push({ x: labelW + d * cell, label: date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) });
  }
  if (months.length > 1 && months[1].x - months[0].x < 30) months.shift();

  return (
    <Card
      title="Activity"
      sub={`${noun[0].toUpperCase() + noun.slice(1)} per repo per day, last ${windowDays} days. Click a cell to list the items, or a name to focus that repo.`}
      actions={<Seg label="Metric" value={metric} onChange={setMetric} options={METRICS} />}
      delay={delay}
    >
      <div ref={ref} className="overflow-x-auto">
        {cell > 0 && (
          <svg width={svgW} height={top + shown.length * (rowH + gap) + 4} role="img" aria-label={`Heatmap of ${noun}`}>
            {months.map((m) => (
              <text key={m.x} x={m.x} y={11} className="tick">
                {m.label}
              </text>
            ))}
            <text x={svgW - 2} y={11} className="tick" textAnchor="end">
              total
            </text>
            {shown.map((row, ri) => {
              const y = top + ri * (rowH + gap);
              const dim = selected !== null && selected !== row.repo.i;
              return (
                <g key={row.repo.id} opacity={dim ? 0.35 : 1}>
                  <g
                    className="hit"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(selected === row.repo.i ? null : row.repo.i)}
                    onKeyDown={(e) => e.key === "Enter" && onSelect(selected === row.repo.i ? null : row.repo.i)}
                  >
                    <rect x={0} y={y} width={labelW - 6} height={rowH} fill="transparent" />
                    <rect x={0} y={y + rowH / 2 - 3} width={6} height={6} rx={1.5} fill={GROUP_COLOR[row.repo.group]} />
                    <text
                      x={11}
                      y={y + rowH / 2 + 4}
                      style={{ fontSize: 11.5, fontWeight: row.repo.focus || selected === row.repo.i ? 650 : 400 }}
                      fill="var(--ink-2)"
                    >
                      {row.repo.short.length > 15 ? row.repo.short.slice(0, 14) + "…" : row.repo.short}
                    </text>
                  </g>
                  {row.cells.map((items, d) => (
                    <rect
                      key={d}
                      x={labelW + d * cell}
                      y={y}
                      width={cell - gap}
                      height={rowH}
                      rx={Math.min(2, cell / 4)}
                      fill={fill(items.length)}
                      className={items.length ? "hit" : undefined}
                      onPointerMove={(e) =>
                        show(e, <TipBody title={`${row.repo.short} · ${fmtDate(start + d * DAY)}`} rows={[{ k: noun, v: items.length }]} />)
                      }
                      onPointerLeave={hide}
                      onClick={() =>
                        items.length && onDrill(`${row.repo.short}: ${noun} on ${fmtDate(start + d * DAY)}`, items)
                      }
                    />
                  ))}
                  <text
                    x={svgW - 2}
                    y={y + rowH / 2 + 4}
                    textAnchor="end"
                    className="hit"
                    style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}
                    fill="var(--ink)"
                    onClick={() => onDrill(`${row.repo.short}: ${noun}, last ${windowDays} days`, row.cells.flat())}
                  >
                    {row.total}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {rows.length === 0 && <p className="py-8 text-center text-[var(--ink-2)]">No {noun} in this scope.</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--ink-2)]">
          Fewer
          {FILLS.map((f, i) => (
            <span key={f} className="flex items-center gap-1">
              <span className="swatch" style={{ background: f }} />
              <span className="tabular-nums">{LEGEND[i]}</span>
            </span>
          ))}
          More
        </span>
        {rows.length > 14 && (
          <button type="button" className="pill" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show top 14" : `Show all ${rows.length} repos`}
          </button>
        )}
      </div>
    </Card>
  );
}
