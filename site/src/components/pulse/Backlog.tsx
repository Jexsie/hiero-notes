"use client";

import { useState } from "react";
import { AGE_BUCKETS, DAY, ageBucket, type Issue, type Item, type Repo } from "@/lib/pulse/model";
import { Card, GROUP_COLOR, TipBody, useTooltip, useWidth } from "./ui";

const FILLS = ["var(--a1)", "var(--a2)", "var(--a3)", "var(--a4)", "var(--a5)"];

export function Backlog({
  repos,
  issues,
  now,
  selected,
  onSelect,
  onDrill,
  delay,
}: {
  repos: Repo[];
  issues: Issue[];
  now: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const open = issues.filter((i) => !i.closed && (!unassignedOnly || i.assignees.length === 0));
  const byRepo = new Map<number, Issue[][]>();
  for (const it of open) {
    let row = byRepo.get(it.repo);
    if (!row) byRepo.set(it.repo, (row = AGE_BUCKETS.map(() => [])));
    row[ageBucket((now - it.created) / DAY)].push(it);
  }
  const rows = repos
    .filter((r) => byRepo.has(r.i))
    .map((r) => ({ repo: r, buckets: byRepo.get(r.i)!, total: byRepo.get(r.i)!.reduce((n, b) => n + b.length, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => r.total));

  const labelW = 112;
  const valueW = 44;
  const barH = 14;
  const rowGap = 10;
  const plot = Math.max(10, width - labelW - valueW);

  return (
    <Card
      title="Issue backlog by age"
      sub="Open issues per repo, split by how long ago they were opened. Click a segment to list it."
      actions={
        <label className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-2)]">
          <input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
          Unassigned only
        </label>
      }
      delay={delay}
    >
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
        {AGE_BUCKETS.map((b, i) => (
          <span key={b.key} className="flex items-center gap-1.5 text-[0.75rem] text-[var(--ink-2)]">
            <span className="swatch" style={{ background: FILLS[i] }} />
            {b.label}
          </span>
        ))}
      </div>
      <div ref={ref}>
        {width > 0 && (
          <svg width={width} height={rows.length * (barH + rowGap)} role="img" aria-label="Open issues by age per repository">
            {rows.map((row, ri) => {
              const y = ri * (barH + rowGap);
              let x = labelW;
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
                    <rect x={0} y={y} width={labelW - 8} height={barH} fill="transparent" />
                    <rect x={0} y={y + barH / 2 - 3} width={6} height={6} rx={1.5} fill={GROUP_COLOR[row.repo.group]} />
                    <text x={11} y={y + barH / 2 + 4} style={{ fontSize: 11.5, fontWeight: row.repo.focus ? 650 : 400 }} fill="var(--ink-2)">
                      {row.repo.short.length > 15 ? row.repo.short.slice(0, 14) + "…" : row.repo.short}
                    </text>
                  </g>
                  {row.buckets.map((items, bi) => {
                    if (!items.length) return null;
                    const w = (items.length / max) * plot;
                    const segX = x;
                    x += w;
                    const isLast = row.buckets.slice(bi + 1).every((b) => !b.length);
                    const unassigned = items.filter((i) => i.assignees.length === 0).length;
                    return (
                      <path
                        key={bi}
                        className="hit"
                        d={segment(segX, y, Math.max(1, w - (isLast ? 0 : 2)), barH, isLast ? 4 : 0)}
                        fill={FILLS[bi]}
                        onPointerMove={(e) =>
                          show(
                            e,
                            <TipBody
                              title={`${row.repo.short} · ${AGE_BUCKETS[bi].label}`}
                              rows={[
                                { k: "open issues", v: items.length, key: FILLS[bi] },
                                { k: "unassigned", v: unassigned },
                              ]}
                            />,
                          )
                        }
                        onPointerLeave={hide}
                        onClick={() => onDrill(`${row.repo.short}: open issues ${AGE_BUCKETS[bi].label} old`, items)}
                      />
                    );
                  })}
                  <text
                    x={labelW + (row.total / max) * plot + 6}
                    y={y + barH / 2 + 4}
                    style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}
                    fill="var(--ink)"
                  >
                    {row.total}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </Card>
  );
}

/** Rect with only the data end (right) rounded; square at the baseline. */
function segment(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}
