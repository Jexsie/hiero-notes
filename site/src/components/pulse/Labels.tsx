"use client";

import { type Issue, type Item } from "@/lib/pulse/model";
import { Card, TipBody, useTooltip, useWidth } from "./ui";

/** Most-used labels on open issues in scope. */
export function Labels({
  issues,
  onDrill,
  delay,
}: {
  issues: Issue[];
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const open = issues.filter((i) => !i.closed);
  // Repos spell labels differently ("bug" vs "Bug"); group case-insensitively.
  const by = new Map<string, { label: string; items: Issue[] }>();
  for (const it of open)
    for (const l of new Set(it.labels.map((x) => x.toLowerCase()))) {
      const entry = by.get(l) ?? { label: it.labels.find((x) => x.toLowerCase() === l)!, items: [] };
      entry.items.push(it);
      by.set(l, entry);
    }
  const unlabelled = open.filter((i) => i.labels.length === 0);
  const rows = [...by.values()].sort((a, b) => b.items.length - a.items.length).slice(0, 12);
  const max = Math.max(1, ...rows.map((r) => r.items.length));

  const labelW = 150;
  const valueW = 44;
  const barH = 14;
  const gap = 9;
  const plot = Math.max(10, width - labelW - valueW);

  return (
    <Card title="Top labels" sub="Labels on open issues in scope. Click one to list its issues." delay={delay}>
      <div ref={ref}>
        {width > 0 && (
          <svg width={width} height={rows.length * (barH + gap)} role="img" aria-label="Open issues by label">
            {rows.map((r, i) => {
              const y = i * (barH + gap);
              const w = (r.items.length / max) * plot;
              return (
                <g
                  key={r.label}
                  className="hit"
                  onClick={() => onDrill(`Open issues labelled “${r.label}”`, r.items)}
                  onPointerMove={(e) =>
                    show(
                      e,
                      <TipBody
                        title={r.label}
                        rows={[
                          { k: "open issues", v: r.items.length },
                          { k: "unassigned", v: r.items.filter((x) => x.assignees.length === 0).length },
                        ]}
                      />,
                    )
                  }
                  onPointerLeave={hide}
                >
                  <rect x={0} y={y - 3} width={width} height={barH + 6} fill="transparent" />
                  <text x={0} y={y + barH / 2 + 4} style={{ fontSize: 11.5 }} fill="var(--ink-2)">
                    {r.label.length > 21 ? r.label.slice(0, 20) + "…" : r.label}
                  </text>
                  <path d={bar(labelW, y, Math.max(2, w), barH)} fill="var(--s1)" />
                  <text x={labelW + w + 6} y={y + barH / 2 + 4} style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }} fill="var(--ink)">
                    {r.items.length}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {rows.length === 0 && <p className="py-8 text-center text-[var(--ink-2)]">No labelled open issues in this scope.</p>}
        {unlabelled.length > 0 && (
          <button
            type="button"
            className="pill wrap mt-3 text-left"
            onClick={() => onDrill("Open issues with no label", unlabelled)}
          >
            <strong className="text-[var(--ink)]">{unlabelled.length.toLocaleString()}</strong> open issues have no label → list
          </button>
        )}
      </div>
    </Card>
  );
}

function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
