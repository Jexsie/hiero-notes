"use client";

import { Children, useState, type ReactNode } from "react";

export type TabSpec = { label: string; count: number; color: string };

/** Tab strip over server-rendered panels. "All" shows every panel. */
export function Tabs({ tabs, children }: { tabs: TabSpec[]; children: ReactNode }) {
  const [active, setActive] = useState(-1);
  const panels = Children.toArray(children);
  const total = tabs.reduce((n, t) => n + t.count, 0);

  return (
    <>
      <div role="tablist" className="flex overflow-x-auto border-b border-[var(--line)] px-2">
        {[{ label: "All", count: total, color: "var(--sig)" }, ...tabs].map((t, i) => {
          const index = i - 1;
          return (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={active === index}
              onClick={() => setActive(index)}
              className="tab"
              style={{ "--c": t.color } as React.CSSProperties}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
            </button>
          );
        })}
      </div>
      {panels.map((panel, i) => (
        <div key={i} hidden={active !== -1 && active !== i}>
          {panel}
        </div>
      ))}
    </>
  );
}
