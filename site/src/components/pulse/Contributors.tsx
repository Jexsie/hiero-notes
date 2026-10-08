"use client";

import { DAY, type Item, type Pr } from "@/lib/pulse/model";
import { Card, TipBody, useTooltip, useWidth } from "./ui";

export function Contributors({
  prs,
  now,
  windowDays,
  user,
  onDrill,
  delay,
}: {
  prs: Pr[];
  now: number;
  windowDays: number;
  user: string;
  onDrill: (title: string, items: Item[]) => void;
  delay?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const start = now - windowDays * DAY;
  const by = new Map<string, Pr[]>();
  for (const p of prs) {
    if (!p.merged || p.merged < start || p.bot || !p.author) continue;
    by.set(p.author, [...(by.get(p.author) ?? []), p]);
  }
  const ranked = [...by.entries()].map(([login, items]) => ({ login, items })).sort((a, b) => b.items.length - a.items.length);
  const rows = ranked.slice(0, 12);
  const meIndex = ranked.findIndex((r) => r.login === user);
  if (meIndex >= 12) rows.push(ranked[meIndex]);
  const max = Math.max(1, ...rows.map((r) => r.items.length));

  const labelW = 132;
  const valueW = 40;
  const barH = 14;
  const gap = 9;
  const plot = Math.max(10, width - labelW - valueW);

  return (
    <Card
      title="Who's shipping"
      sub={`Merged PRs per person, last ${windowDays} days (bots excluded). ${ranked.length} people in total.`}
      delay={delay}
    >
      <div ref={ref}>
        {width > 0 && (
          <svg width={width} height={rows.length * (barH + gap)} role="img" aria-label="Merged pull requests by author">
            {rows.map((r, i) => {
              const y = i * (barH + gap);
              const w = (r.items.length / max) * plot;
              const me = r.login === user;
              return (
                <g
                  key={r.login}
                  className="hit"
                  onClick={() => onDrill(`Merged by ${r.login}, last ${windowDays} days`, r.items)}
                  onPointerMove={(e) =>
                    show(e, <TipBody title={r.login} rows={[{ k: "merged PRs", v: r.items.length }, { k: "repos", v: new Set(r.items.map((p) => p.repo)).size }]} />)
                  }
                  onPointerLeave={hide}
                >
                  <rect x={0} y={y - 3} width={width} height={barH + 6} fill="transparent" />
                  <text x={0} y={y + barH / 2 + 4} style={{ fontSize: 11.5, fontWeight: me ? 650 : 400 }} fill={me ? "var(--ink)" : "var(--ink-2)"}>
                    {meIndex >= 12 && me ? `#${meIndex + 1} ` : ""}
                    {r.login.length > 17 ? r.login.slice(0, 16) + "…" : r.login}
                    {me ? " (you)" : ""}
                  </text>
                  <path d={bar(labelW, y, Math.max(2, w), barH)} fill={me ? "var(--s2)" : "var(--s1)"} />
                  <text x={labelW + w + 6} y={y + barH / 2 + 4} style={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }} fill="var(--ink)">
                    {r.items.length}
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

function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
