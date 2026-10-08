"use client";

import { useEffect, useState } from "react";
import { fmtAge, type Item, type Repo } from "@/lib/pulse/model";
import { GROUP_COLOR } from "./ui";

type Sort = "updated" | "created";

/** Side panel listing the items behind whatever was clicked. Doubles as the table view. */
export function Drawer({
  title,
  items,
  repos,
  now,
  onClose,
}: {
  title: string;
  items: Item[];
  repos: Repo[];
  now: number;
  onClose: () => void;
}) {
  const [sort, setSort] = useState<Sort>("updated");
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const needle = q.trim().toLowerCase();
  const list = items
    .filter((it) => !needle || it.title.toLowerCase().includes(needle) || repos[it.repo].short.toLowerCase().includes(needle) || (it.author ?? "").toLowerCase().includes(needle))
    .sort((a, b) => (sort === "updated" ? b.updated - a.updated : b.created - a.created));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="card flex h-full w-full max-w-[560px] flex-col rounded-none border-y-0 border-r-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--grid)] p-4">
          <div className="min-w-0">
            <h2 className="text-[1rem] font-semibold">{title}</h2>
            <p className="text-[0.8rem] text-[var(--ink-2)]">
              {list.length} of {items.length} items
            </p>
          </div>
          <button type="button" onClick={onClose} className="pill" aria-label="Close">
            Close · Esc
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--grid)] px-4 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title, repo or author"
            className="min-w-0 flex-1 rounded-md border border-[var(--ring)] bg-[var(--plane)] px-2 py-1 text-[0.85rem] outline-none focus:border-[var(--s1)]"
          />
          <div className="seg">
            {(["updated", "created"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
                {s === "updated" ? "Recently active" : "Newest"}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y divide-[var(--grid)] overflow-y-auto">
          {list.slice(0, 300).map((it) => {
            const repo = repos[it.repo];
            const state =
              it.kind === "pr"
                ? it.merged
                  ? "merged"
                  : it.closed
                    ? "closed"
                    : it.draft
                      ? "draft"
                      : it.review === "approved"
                        ? "approved"
                        : it.review === "changes"
                          ? "changes requested"
                          : "open"
                : it.closed
                  ? "closed"
                  : it.assignees.length
                    ? `@${it.assignees[0]}`
                    : "unassigned";
            return (
              <li key={`${it.kind}-${it.repo}-${it.number}`}>
                <a href={it.url} target="_blank" rel="noreferrer" className="row-link flex gap-3 px-4 py-2.5">
                  <span className="swatch mt-1.5" style={{ background: GROUP_COLOR[repo.group] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.88rem] leading-snug">{it.title}</span>
                    <span className="mt-0.5 block text-[0.74rem] text-[var(--ink-2)]">
                      {repo.short} {it.kind === "pr" ? "PR" : "issue"} #{it.number} · {it.author ?? "ghost"} · opened {fmtAge(now - it.created)} ago · active{" "}
                      {fmtAge(now - it.updated)} ago
                      {it.kind === "pr" && it.size ? ` · ${it.size.toLocaleString()} lines` : ""}
                    </span>
                  </span>
                  <span className="flex-none self-center rounded-full border border-[var(--ring)] px-2 py-0.5 text-[0.7rem] text-[var(--ink-2)]">
                    {state}
                  </span>
                </a>
              </li>
            );
          })}
          {list.length > 300 && (
            <li className="px-4 py-3 text-center text-[0.8rem] text-[var(--ink-2)]">Showing the first 300. Filter to narrow it down.</li>
          )}
        </ul>
      </aside>
    </div>
  );
}
