"use client";

import { scaleLinear, scaleTime } from "d3-scale";
import { line } from "d3-shape";
import { useState } from "react";
import { DAY, fmtDate, type Issue, type Item, type Pr } from "@/lib/pulse/model";
import { Card, TipBody, useTooltip, useWidth } from "./ui";

export function Flow({
  issues,
  prs,
  now,
  windowDays,
  onDrill,
  delay,
}: {
  issues: Issue[];
  prs: Pr[];
  now: number;
  windowDays: number;
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const [hoverBin, setHoverBin] = useState<number | null>(null);

  const step = windowDays > 30 ? 7 : 3;
  const bins = Math.floor(windowDays / step);
  const start = now - bins * step * DAY;
  const binOf = (t: number) => Math.floor((t - start) / (step * DAY));

  const series = [
    { key: "opened", label: "Issues opened", color: "var(--s1)", items: issues.filter((i) => i.created >= start), at: (i: Item) => i.created },
    { key: "closed", label: "Issues closed", color: "var(--s2)", items: issues.filter((i) => i.closed && i.closed >= start), at: (i: Item) => i.closed! },
    { key: "merged", label: "PRs merged", color: "var(--s3)", items: prs.filter((p) => p.merged && p.merged >= start), at: (i: Item) => (i as Pr).merged! },
  ].map((s) => {
    const byBin: Item[][] = Array.from({ length: bins }, () => []);
    for (const it of s.items) {
      const b = binOf(s.at(it));
      if (b >= 0 && b < bins) byBin[b].push(it);
    }
    return { ...s, byBin, counts: byBin.map((b) => b.length) };
  });

  const height = 240;
  const m = { l: 36, r: 96, t: 12, b: 24 };
  const binMid = (b: number) => start + (b + 0.5) * step * DAY;
  const x = scaleTime().domain([start, now]).range([m.l, Math.max(m.l + 10, width - m.r)]);
  const max = Math.max(4, ...series.flatMap((s) => s.counts));
  const y = scaleLinear().domain([0, max]).nice(4).range([height - m.b, m.t]);
  const path = line<number>()
    .x((_, i) => x(binMid(i)))
    .y((v) => y(v));

  return (
    <Card
      title="Flow"
      sub={`Per ${step === 7 ? "week" : `${step} days`}: is the backlog shrinking? Closed above opened means yes.`}
      delay={delay}
    >
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-2)]">
            <span className="linekey" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={ref}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Issues opened, issues closed and PRs merged over time"
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const t = x.invert(e.clientX - box.left).getTime();
              const b = Math.min(bins - 1, Math.max(0, binOf(t)));
              setHoverBin(b);
              show(
                e,
                <TipBody
                  title={`${fmtDate(start + b * step * DAY)} – ${fmtDate(start + (b + 1) * step * DAY - 1)}`}
                  rows={series.map((s) => ({ k: s.label, v: s.counts[b], key: s.color }))}
                />,
              );
            }}
            onPointerLeave={() => {
              setHoverBin(null);
              hide();
            }}
            onClick={() =>
              hoverBin !== null &&
              onDrill(
                `Week of ${fmtDate(start + hoverBin * step * DAY)}`,
                series.flatMap((s) => s.byBin[hoverBin]),
              )
            }
            className="cursor-crosshair"
          >
            {y.ticks(4).map((t) => (
              <g key={t}>
                <line x1={m.l} x2={x.range()[1]} y1={y(t)} y2={y(t)} className={t === 0 ? "axisline" : "gridline"} />
                <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="tick">
                  {t}
                </text>
              </g>
            ))}
            {x.ticks(5).map((t) => (
              <text key={+t} x={x(t)} y={height - 6} textAnchor="middle" className="tick">
                {fmtDate(+t)}
              </text>
            ))}
            {hoverBin !== null && (
              <line x1={x(binMid(hoverBin))} x2={x(binMid(hoverBin))} y1={m.t} y2={height - m.b} stroke="var(--axis)" />
            )}
            {series.map((s) => (
              <path key={s.key} d={path(s.counts) ?? ""} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.map((s) => (
              <g key={`end-${s.key}`}>
                <circle cx={x(binMid(bins - 1))} cy={y(s.counts[bins - 1])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                {hoverBin !== null && (
                  <circle cx={x(binMid(hoverBin))} cy={y(s.counts[hoverBin])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                )}
              </g>
            ))}
            {/* end labels, spread so they don't overlap */}
            {spread(series.map((s) => y(s.counts[bins - 1])), 13).map((ly, i) => (
              <text key={series[i].key} x={x(binMid(bins - 1)) + 10} y={ly + 4} style={{ fontSize: 11.5 }} fill="var(--ink-2)">
                <tspan fill="var(--ink)" fontWeight={600}>
                  {series[i].counts[bins - 1]}
                </tspan>{" "}
                {series[i].key}
              </text>
            ))}
          </svg>
        )}
      </div>
    </Card>
  );
}

/** Push label positions apart to at least `gap` px while keeping their order. */
function spread(ys: number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) if (order[k].y - order[k - 1].y < gap) order[k].y = order[k - 1].y + gap;
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}
