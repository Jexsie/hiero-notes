"use client";

import { scaleTime } from "d3-scale";
import { DAY, fmtDate, type Repo } from "@/lib/pulse/model";
import { Card, GROUP_COLOR, TipBody, useTooltip, useWidth } from "./ui";

export function Releases({
  repos,
  now,
  windowDays,
  delay,
}: {
  repos: Repo[];
  now: number;
  windowDays: number;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const start = now - windowDays * DAY;
  const rows = repos
    .map((r) => ({ repo: r, rel: r.releases.filter((x) => x.at >= start) }))
    .filter((r) => r.rel.length)
    .sort((a, b) => Math.max(...b.rel.map((x) => x.at)) - Math.max(...a.rel.map((x) => x.at)))
    .slice(0, 14);

  const labelW = 112;
  const rowH = 22;
  const top = 6;
  const bottom = 20;
  const x = scaleTime().domain([start, now]).range([labelW + 8, Math.max(labelW + 20, width - 30)]);

  return (
    <Card title="Releases" sub={`Each dot is a release in the last ${windowDays} days. Hollow = pre-release. Click to open.`} delay={delay}>
      <div ref={ref}>
        {width > 0 && rows.length > 0 && (
          <svg width={width} height={top + rows.length * rowH + bottom} role="img" aria-label="Release timeline">
            {x.ticks(5).map((t) => (
              <g key={+t}>
                <line x1={x(t)} x2={x(t)} y1={top} y2={top + rows.length * rowH} className="gridline" />
                <text x={x(t)} y={top + rows.length * rowH + 14} textAnchor="middle" className="tick">
                  {fmtDate(+t)}
                </text>
              </g>
            ))}
            {rows.map((row, i) => {
              const cy = top + i * rowH + rowH / 2;
              const color = GROUP_COLOR[row.repo.group];
              return (
                <g key={row.repo.id}>
                  <line x1={labelW + 8} x2={x.range()[1]} y1={cy} y2={cy} className="gridline" />
                  <text x={0} y={cy + 4} style={{ fontSize: 11.5, fontWeight: row.repo.focus ? 650 : 400 }} fill="var(--ink-2)">
                    {row.repo.short.length > 15 ? row.repo.short.slice(0, 14) + "…" : row.repo.short}
                  </text>
                  <text x={width} y={cy + 4} textAnchor="end" className="tick">
                    {row.rel.length}
                  </text>
                  {row.rel.map((r) => (
                    <a key={r.tag} href={r.url} target="_blank" rel="noreferrer">
                      <circle cx={x(r.at)} cy={cy} r={12} fill="transparent"
                        onPointerMove={(e) =>
                          show(e, <TipBody title={`${row.repo.short} ${r.tag}`} rows={[{ k: r.pre ? "pre-release" : "release", v: fmtDate(r.at) }]} />)
                        }
                        onPointerLeave={hide}
                      />
                      <circle
                        cx={x(r.at)}
                        cy={cy}
                        r={r.pre ? 4 : 5}
                        fill={r.pre ? "var(--surface)" : color}
                        stroke={r.pre ? color : "var(--surface)"}
                        strokeWidth={r.pre ? 1.5 : 2}
                        pointerEvents="none"
                      />
                    </a>
                  ))}
                </g>
              );
            })}
          </svg>
        )}
        {rows.length === 0 && <p className="py-8 text-center text-[var(--ink-2)]">No releases in this scope.</p>}
      </div>
    </Card>
  );
}
