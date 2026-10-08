"use client";

import { scaleLog } from "d3-scale";
import { useState } from "react";
import { DAY, fmtAge, type Item, type Pr, type Repo, type ReviewState } from "@/lib/pulse/model";
import { Card, TipBody, useTooltip, useWidth } from "./ui";

/** First three categorical slots: the only ones validated for all-pairs (scatter). */
const STATES: { key: ReviewState; label: string; color: string }[] = [
  { key: "waiting", label: "Waiting for review", color: "var(--s1)" },
  { key: "changes", label: "Changes requested", color: "var(--s2)" },
  { key: "approved", label: "Approved", color: "var(--s3)" },
];

const QUICK_IDLE = 3; // days
const QUICK_SIZE = 300; // changed lines

export function PrHealth({
  prs,
  repos,
  now,
  user,
  onDrill,
  delay,
}: {
  prs: Pr[];
  repos: Repo[];
  now: number;
  user: string;
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Pr | null>(null);

  const open = prs.filter((p) => !p.closed);
  const visible = open.filter((p) => !hidden.has(p.draft ? "draft" : p.review));
  const idle = (p: Pr) => Math.max(0.1, (now - p.updated) / DAY);
  const size = (p: Pr) => Math.max(1, p.size);

  const height = 360;
  const m = { l: 40, r: 12, t: 10, b: 26 };
  const maxIdle = Math.max(400, ...open.map(idle));
  const maxSize = Math.max(10_000, ...open.map(size));
  const x = scaleLog().domain([0.1, maxIdle]).range([m.l, Math.max(m.l + 10, width - m.r)]).clamp(true);
  const y = scaleLog().domain([1, maxSize]).range([height - m.b, m.t]).clamp(true);

  const quick = open.filter((p) => !p.draft && p.review === "waiting" && idle(p) >= QUICK_IDLE && p.size <= QUICK_SIZE);
  const mine = (p: Pr) => p.author === user || p.requested.includes(user);

  function nearest(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    let best: Pr | null = null;
    let bestD = 24 * 24; // 24px hit radius
    for (const p of visible) {
      const dx = x(idle(p)) - px;
      const dy = y(size(p)) - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  const xTicks = [1, 3, 7, 14, 30, 90, 365].filter((t) => t <= maxIdle);
  const yTicks = [1, 10, 100, 1000, 10_000, 100_000].filter((t) => t <= maxSize);
  const fmtX = (d: number) => (d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${Math.round(d / 365)}y`);
  const fmtY = (n: number) => (n >= 1000 ? `${n / 1000}K` : String(n));

  return (
    <Card
      title="Pull request health"
      sub="Every open PR by days since last activity and lines changed. Hover a dot for details, click to open it on GitHub."
      delay={delay}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[...STATES, { key: "draft", label: "Draft", color: "var(--muted)" }].map((s) => {
          const n = open.filter((p) => (p.draft ? "draft" : p.review) === s.key).length;
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className="pill"
              aria-pressed={!off}
              onClick={() => {
                const next = new Set(hidden);
                if (off) next.delete(s.key);
                else next.add(s.key);
                setHidden(next);
              }}
              style={{ opacity: off ? 0.5 : 1 }}
            >
              <svg width={10} height={10} aria-hidden>
                {s.key === "draft" ? (
                  <circle cx={5} cy={5} r={3.5} fill="none" stroke={s.color} strokeWidth={1.5} />
                ) : (
                  <circle cx={5} cy={5} r={4.5} fill={s.color} />
                )}
              </svg>
              {s.label} <span className="tabular-nums text-[var(--muted)]">{n}</span>
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1.5 text-[0.75rem] text-[var(--ink-2)]">
          <svg width={14} height={14} aria-hidden>
            <circle cx={7} cy={7} r={6} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
          </svg>
          yours or asking for your review
        </span>
      </div>
      <div ref={ref}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Scatter of open pull requests by idle time and size"
            onPointerMove={(e) => {
              const p = nearest(e);
              setHover(p);
              if (p) {
                const repo = repos[p.repo];
                show(
                  e,
                  <TipBody
                    title={`${repo.short} #${p.number}`}
                    rows={[
                      { k: p.title, v: "" },
                      { k: "idle", v: fmtAge(now - p.updated) },
                      { k: "lines changed", v: p.size.toLocaleString() },
                      { k: p.author ? `by ${p.author}` : "", v: p.draft ? "Draft" : STATES.find((s) => s.key === p.review)!.label },
                    ]}
                  />,
                );
              } else hide();
            }}
            onPointerLeave={() => {
              setHover(null);
              hide();
            }}
            onClick={() => hover && window.open(hover.url, "_blank", "noreferrer")}
            style={{ cursor: hover ? "pointer" : "default" }}
          >
            {/* quick-review zone */}
            <rect
              x={x(QUICK_IDLE)}
              y={y(QUICK_SIZE)}
              width={x.range()[1] - x(QUICK_IDLE)}
              height={y(1) - y(QUICK_SIZE)}
              fill="var(--wash)"
              rx={6}
            />
            {xTicks.map((t) => (
              <g key={`x${t}`}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={height - m.b} className="gridline" />
                <text x={x(t)} y={height - 8} textAnchor="middle" className="tick">
                  {fmtX(t)}
                </text>
              </g>
            ))}
            {yTicks.map((t) => (
              <g key={`y${t}`}>
                <line x1={m.l} x2={x.range()[1]} y1={y(t)} y2={y(t)} className="gridline" />
                <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="tick">
                  {fmtY(t)}
                </text>
              </g>
            ))}
            <line x1={m.l} x2={x.range()[1]} y1={height - m.b} y2={height - m.b} className="axisline" />
            <text x={x.range()[1]} y={height - m.b - 6} textAnchor="end" className="tick">
              idle →
            </text>
            <text x={m.l + 4} y={m.t + 10} className="tick">
              ↑ lines changed
            </text>

            {visible.map((p) => {
              const cx = x(idle(p));
              const cy = y(size(p));
              const color = p.draft ? "var(--muted)" : STATES.find((s) => s.key === p.review)!.color;
              return (
                <g key={`${p.repo}-${p.number}`} opacity={hover && hover !== p ? 0.55 : 1}>
                  {mine(p) && <circle cx={cx} cy={cy} r={8} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
                  {p.draft ? (
                    <circle cx={cx} cy={cy} r={4} fill="var(--surface)" stroke={color} strokeWidth={1.5} />
                  ) : (
                    <circle cx={cx} cy={cy} r={hover === p ? 6 : 4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <button
        type="button"
        className="pill wrap mt-2 text-left"
        onClick={() => onDrill(`Quick reviews: waiting ≥ ${QUICK_IDLE} days, ≤ ${QUICK_SIZE} lines`, quick)}
      >
        <span className="swatch" style={{ background: "var(--wash)", outline: "1px solid var(--s1)" }} />
        Shaded area: quick reviews (waiting ≥ {QUICK_IDLE}d, ≤ {QUICK_SIZE} lines) ·{" "}
        <strong className="text-[var(--ink)]">{quick.length}</strong> → list
      </button>
    </Card>
  );
}
