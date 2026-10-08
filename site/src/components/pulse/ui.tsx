"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GroupKey } from "@/lib/pulse/model";

export const GROUP_COLOR: Record<GroupKey, string> = {
  sdk: "var(--s1)",
  network: "var(--s2)",
  tooling: "var(--s3)",
  community: "var(--s4)",
  identity: "var(--s5)",
  clpr: "var(--s6)",
};

/** Fills where white text reads better than ink (dark enough in both modes). */
export const GROUP_TEXT: Record<GroupKey, string> = {
  sdk: "#fff",
  network: "#fff",
  tooling: "#0b0b0b",
  community: "#0b0b0b",
  identity: "#0b0b0b",
  clpr: "#fff",
};

/** Width of an element, kept up to date with ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

type Tip = { x: number; y: number; content: ReactNode } | null;
const TipContext = createContext<{
  show: (e: { clientX: number; clientY: number }, content: ReactNode) => void;
  hide: () => void;
}>({ show: () => {}, hide: () => {} });

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip>(null);
  const show = useCallback(
    (e: { clientX: number; clientY: number }, content: ReactNode) =>
      setTip({ x: e.clientX, y: e.clientY, content }),
    [],
  );
  const hide = useCallback(() => setTip(null), []);
  // Keep the tooltip on screen: flip left/up near the right/bottom edges.
  const style: React.CSSProperties = {};
  if (tip) {
    const right = tip.x > window.innerWidth - 340;
    const bottom = tip.y > window.innerHeight - 160;
    style.left = right ? undefined : tip.x + 14;
    style.right = right ? window.innerWidth - tip.x + 14 : undefined;
    style.top = bottom ? undefined : tip.y + 14;
    style.bottom = bottom ? window.innerHeight - tip.y + 14 : undefined;
  }
  return (
    <TipContext.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div className="tooltip" style={style} role="tooltip">
          {tip.content}
        </div>
      )}
    </TipContext.Provider>
  );
}

export function useTooltip() {
  return useContext(TipContext);
}

export function Card({
  title,
  sub,
  actions,
  children,
  className = "",
  delay = 0,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section className={`card rise min-w-0 ${className}`} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <div className="card-head">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {actions}
      </div>
      <div className="px-4 pb-4 pt-2">{children}</div>
    </section>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tooltip body: value leads, label follows. */
export function TipBody({ title, rows }: { title: string; rows: { k: string; v: ReactNode; key?: string }[] }) {
  return (
    <div>
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.k} className="flex items-center gap-2">
          {r.key && <span className="linekey" style={{ background: r.key }} />}
          <span className="v tabular-nums">{r.v}</span>
          <span className="k">{r.k}</span>
        </div>
      ))}
    </div>
  );
}
