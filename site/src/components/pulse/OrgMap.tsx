"use client";

import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { useState } from "react";
import { DAY, GROUPS, fmtAge, type Issue, type Pr, type Repo } from "@/lib/pulse/model";
import { Card, GROUP_COLOR, GROUP_TEXT, Seg, TipBody, useTooltip, useWidth } from "./ui";

type Metric = "open" | "activity";

type Leaf = { repo: Repo; open: number; activity: number; value: number };
type Node = { name: string; key?: string; children?: Node[]; leaf?: Leaf };

export function OrgMap({
  repos,
  issues,
  prs,
  now,
  windowDays,
  selected,
  onSelect,
  delay,
}: {
  repos: Repo[];
  issues: Issue[];
  prs: Pr[];
  now: number;
  windowDays: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
  delay?: number;
}) {
  const [metric, setMetric] = useState<Metric>("open");
  const [ref, width] = useWidth<HTMLDivElement>();
  const { show, hide } = useTooltip();
  const height = 360;
  const start = now - windowDays * DAY;

  const activity = new Map<number, number>();
  for (const p of prs) if (p.merged && p.merged >= start) activity.set(p.repo, (activity.get(p.repo) ?? 0) + 1);
  for (const i of issues) if (i.closed && i.closed >= start) activity.set(i.repo, (activity.get(i.repo) ?? 0) + 1);

  const leaves: Leaf[] = repos.map((repo) => {
    const open = repo.openIssues + repo.openPrs;
    const act = activity.get(repo.i) ?? 0;
    return { repo, open, activity: act, value: metric === "open" ? open : act };
  });

  const root: Node = {
    name: "root",
    children: GROUPS.map((g) => ({
      name: g.label,
      key: g.key,
      children: leaves.filter((l) => l.repo.group === g.key && l.value > 0).map((l) => ({ name: l.repo.short, leaf: l })),
    })).filter((g) => g.children!.length),
  };

  const laid =
    width > 0
      ? treemap<Node>()
          .size([width, height])
          .tile(treemapSquarify)
          .paddingInner(2)
          .paddingOuter(0)
          .paddingTop((d) => (d.depth === 1 ? 20 : 0))(
          hierarchy(root)
            .sum((d) => d.leaf?.value ?? 0)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
        )
      : null;

  return (
    <Card
      title="Org map"
      sub={metric === "open" ? "Area = open issues + PRs. Click a repo to focus the dashboard." : `Area = merged PRs + closed issues in the last ${windowDays} days.`}
      actions={
        <Seg
          label="Size by"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "open", label: "Open work" },
            { value: "activity", label: "Activity" },
          ]}
        />
      }
      delay={delay}
    >
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {GROUPS.filter((g) => repos.some((r) => r.group === g.key)).map((g) => (
          <span key={g.key} className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-2)]">
            <span className="swatch" style={{ background: GROUP_COLOR[g.key as keyof typeof GROUP_COLOR] }} />
            {g.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {laid && (
          <svg width={width} height={height} role="img" aria-label="Treemap of repositories">
            {laid.children?.map((g) => (
              <g key={g.data.name}>
                <text x={g.x0 + 2} y={g.y0 + 14} className="tick" style={{ fontSize: 11, fontWeight: 600 }}>
                  {g.data.name}
                </text>
                {g.leaves().map((n) => {
                  const l = n.data.leaf!;
                  const w = n.x1 - n.x0;
                  const h = n.y1 - n.y0;
                  const key = l.repo.group;
                  const dim = selected !== null && selected !== l.repo.i;
                  const fits = w > 34 && h > 20;
                  const roomy = h > 36;
                  return (
                    <g
                      key={l.repo.id}
                      className="hit"
                      tabIndex={0}
                      role="button"
                      aria-label={`${l.repo.short}: ${l.open} open, ${l.activity} recent`}
                      onClick={() => onSelect(selected === l.repo.i ? null : l.repo.i)}
                      onKeyDown={(e) => e.key === "Enter" && onSelect(selected === l.repo.i ? null : l.repo.i)}
                      onPointerMove={(e) =>
                        show(
                          e,
                          <TipBody
                            title={l.repo.id}
                            rows={[
                              { k: "open issues", v: l.repo.openIssues },
                              { k: "open PRs", v: l.repo.openPrs },
                              { k: `merged + closed, ${windowDays}d`, v: l.activity },
                              { k: "since last push", v: fmtAge(now - l.repo.pushed) },
                            ]}
                          />,
                        )
                      }
                      onPointerLeave={hide}
                      opacity={dim ? 0.3 : 1}
                    >
                      <rect
                        x={n.x0}
                        y={n.y0}
                        width={Math.max(0, w)}
                        height={Math.max(0, h)}
                        rx={4}
                        fill={GROUP_COLOR[key]}
                        stroke={selected === l.repo.i ? "var(--ink)" : "none"}
                        strokeWidth={2}
                      />
                      {fits && (
                        <>
                          <text x={n.x0 + 7} y={n.y0 + 17} fill={GROUP_TEXT[key]} style={{ fontSize: 12, fontWeight: 600 }}>
                            {truncate(l.repo.short, (w - 10) / 6.6)}
                          </text>
                          {roomy && (
                            <text x={n.x0 + 7} y={n.y0 + 32} fill={GROUP_TEXT[key]} style={{ fontSize: 11, opacity: 0.85 }}>
                              {metric === "open" ? l.open : l.activity}
                            </text>
                          )}
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}
      </div>
    </Card>
  );
}

function truncate(s: string, chars: number) {
  const n = Math.max(3, Math.floor(chars));
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
