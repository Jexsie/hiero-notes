"use client";

import { useState } from "react";
import type { RepoCount } from "@/lib/briefings";

/**
 * Bar chart of repo mentions that doubles as a filter: picking a repo dims every
 * list item and table row in the edition that doesn't link to it.
 */
export function RepoLens({ counts, target }: { counts: RepoCount[]; target: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [hits, setHits] = useState(0);
  const max = Math.max(1, ...counts.map((c) => c.count));

  function select(repo: string | null) {
    setActive(repo);
    const root = document.getElementById(target);
    if (!root) return;
    root.toggleAttribute("data-lens", repo !== null);
    let n = 0;
    for (const el of root.querySelectorAll<HTMLElement>("[data-repos]")) {
      const match = repo !== null && el.dataset.repos!.split(" ").includes(repo);
      el.toggleAttribute("data-hit", match);
      if (match && !el.parentElement?.closest("[data-hit]")) n++;
    }
    setHits(n);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
        <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em]">Repo lens</h2>
        {active ? (
          <button
            type="button"
            onClick={() => select(null)}
            className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent hover:underline"
          >
            Clear · {hits} {hits === 1 ? "item" : "items"}
          </button>
        ) : (
          <span className="font-mono text-[0.68rem] text-muted">refs</span>
        )}
      </div>
      <ul className="mt-2 space-y-0.5">
        {counts.map((c) => {
          const on = active === c.repo;
          return (
            <li key={c.repo}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => select(on ? null : c.repo)}
                className={`group grid w-full grid-cols-[7.5rem_1fr_2ch] items-center gap-2 py-1 text-left transition-opacity ${
                  active && !on ? "opacity-40 hover:opacity-80" : ""
                }`}
              >
                <span
                  className={`truncate text-[0.82rem] ${c.focus ? "font-semibold" : ""} ${
                    on ? "text-accent" : ""
                  }`}
                >
                  {c.label}
                </span>
                <span className="relative h-2.5">
                  <span className="absolute inset-y-[0.3rem] left-0 right-0 border-t border-dotted border-rule" />
                  <span
                    className="lens-bar absolute inset-y-0 left-0 origin-left"
                    style={{
                      width: `${(c.count / max) * 100}%`,
                      background: c.color,
                    }}
                  />
                </span>
                <span className="text-right font-mono text-[0.72rem] tabular-nums text-muted">
                  {c.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.75rem] leading-snug text-muted">
        Pick a repo to highlight every item that links to it.
      </p>
    </div>
  );
}
