"use client";

import { useState } from "react";
import type { RepoCount } from "@/lib/briefings";
import { applyLens } from "@/lib/lens";

/** Spectrum bar of repo mentions plus filter chips; picking one dims everything else on the board. */
export function RepoFilter({ counts, target }: { counts: RepoCount[]; target: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [hits, setHits] = useState(0);
  const total = counts.reduce((n, c) => n + c.count, 0) || 1;

  function select(repo: string | null) {
    setActive(repo);
    setHits(applyLens(target, repo));
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          <b>●</b> Spectrum <span className="text-[var(--dim)]">· links by repo</span>
        </h2>
        <span className="label">
          {active ? (
            <button type="button" onClick={() => select(null)} className="text-[var(--sig)] hover:underline">
              filter: {counts.find((c) => c.repo === active)?.label} · {hits} hits · clear ✕
            </button>
          ) : (
            "click to filter"
          )}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex h-7 w-full gap-px overflow-hidden" role="presentation">
          {counts.map((c) => (
            <button
              key={c.repo}
              type="button"
              tabIndex={-1}
              title={`${c.label}: ${c.count}`}
              onClick={() => select(active === c.repo ? null : c.repo)}
              className="fill h-full min-w-[3px] transition-opacity"
              style={{
                width: `${(c.count / total) * 100}%`,
                background: c.color,
                opacity: active && active !== c.repo ? 0.2 : 1,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {counts.map((c) => {
            const on = active === c.repo;
            return (
              <button
                key={c.repo}
                type="button"
                aria-pressed={on}
                onClick={() => select(on ? null : c.repo)}
                className="chip transition-opacity hover:opacity-100"
                style={
                  {
                    "--c": c.focus || on ? c.color : "var(--dim)",
                    opacity: active && !on ? 0.45 : 1,
                    ...(on ? { background: c.color, color: "var(--bg)" } : {}),
                  } as React.CSSProperties
                }
              >
                {c.label}
                <span className="opacity-70">{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
