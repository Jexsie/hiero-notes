"use client";

import { DAY, fmtAge, type Issue, type Pr, type Repo } from "@/lib/pulse/model";
import { Card, GROUP_COLOR } from "./ui";

const STATE: Record<string, { label: string; icon: string; color: string }> = {
  approved: { label: "Approved", icon: "✓", color: "var(--good)" },
  changes: { label: "Changes requested", icon: "!", color: "var(--serious)" },
  waiting: { label: "Waiting for review", icon: "…", color: "var(--muted)" },
  draft: { label: "Draft", icon: "○", color: "var(--muted)" },
};

/** Your PRs, review requests and assignments across every repo (ignores the scope filter). */
export function Radar({
  user,
  repos,
  issues,
  prs,
  now,
  windowDays,
  delay,
}: {
  user: string;
  repos: Repo[];
  issues: Issue[];
  prs: Pr[];
  now: number;
  windowDays: number;
  delay?: number;
}) {
  const open = prs.filter((p) => !p.closed);
  const mine = open.filter((p) => p.author === user);
  const asked = open.filter((p) => p.requested.includes(user));
  const assigned = issues.filter((i) => !i.closed && i.assignees.includes(user));
  const merged = prs.filter((p) => p.author === user && p.merged && p.merged >= now - windowDays * DAY).length;

  const groups = [
    { title: "Your open PRs", items: mine },
    { title: "Asking for your review", items: asked },
    { title: "Assigned to you", items: assigned },
  ];

  return (
    <Card
      title={`Your radar · @${user}`}
      sub={`Across all repos. ${merged} PR${merged === 1 ? "" : "s"} merged in the last ${windowDays} days.`}
      delay={delay}
    >
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-1 flex items-center justify-between text-[0.78rem] text-[var(--ink-2)]">
              {g.title}
              <span className="tabular-nums">{g.items.length}</span>
            </h3>
            {g.items.length === 0 ? (
              <p className="text-[0.8rem] text-[var(--muted)]">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-[var(--grid)]">
                {g.items.map((it) => {
                  const repo = repos[it.repo];
                  const st = it.kind === "pr" ? STATE[it.draft ? "draft" : it.review] : null;
                  return (
                    <li key={`${it.kind}-${it.repo}-${it.number}`}>
                      <a href={it.url} target="_blank" rel="noreferrer" className="row-link -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5">
                        <span className="swatch" style={{ background: GROUP_COLOR[repo.group] }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.85rem]">{it.title}</span>
                          <span className="block text-[0.72rem] text-[var(--ink-2)]">
                            {repo.short} #{it.number} · idle {fmtAge(now - it.updated)}
                          </span>
                        </span>
                        {st && (
                          <span className="flex flex-none items-center gap-1 text-[0.72rem] text-[var(--ink-2)]" title={st.label}>
                            <span
                              className="grid h-4 w-4 place-items-center rounded-full text-[0.62rem] font-bold text-white"
                              style={{ background: st.color }}
                              aria-hidden
                            >
                              {st.icon}
                            </span>
                            <span className="hidden sm:inline">{st.label}</span>
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
