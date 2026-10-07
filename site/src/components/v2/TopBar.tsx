import Link from "next/link";
import { ThemeToggle } from "../ThemeToggle";

export function TopBar({
  code,
  window,
  classicHref = "/",
}: {
  code?: string;
  window?: string;
  classicHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-11 max-w-[1680px] items-center gap-4 px-3 sm:px-5">
        <Link href="/v2/" className="cond flex items-baseline text-[1.35rem] font-extrabold uppercase tracking-tight">
          Hiero<span className="text-[var(--sig)]">{"//"}</span>Signal
        </Link>
        {code && (
          <span className="label hidden items-center gap-2 md:flex">
            <span className="led pulse" /> {code} · {window}
          </span>
        )}
        <nav className="label ml-auto flex items-center gap-3 sm:gap-5">
          <Link href="/v2/" className="hover:text-[var(--fg)]">Latest</Link>
          <Link href="/v2/archive/" className="hover:text-[var(--fg)]">Archive</Link>
          <Link href={classicHref} className="hidden hover:text-[var(--fg)] sm:inline">Ledger view</Link>
          <ThemeToggle light="Dark" dark="Light" suffix="" className="uppercase hover:text-[var(--fg)]" />
        </nav>
      </div>
    </header>
  );
}
