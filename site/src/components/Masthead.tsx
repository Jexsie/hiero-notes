import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  editionNo?: number;
  dateline?: React.ReactNode;
};

export function Masthead({ editionNo, dateline }: Props) {
  return (
    <header className="reveal pt-5" style={{ "--d": "0ms" } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-4 font-mono text-[0.68rem] uppercase tracking-[0.18em]">
        <span className="whitespace-nowrap text-muted">
          {editionNo ? `Vol. I · No. ${editionNo}` : "Back issues"}
        </span>
        <span className="hidden text-muted sm:inline">hiero-ledger · morning edition</span>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link href="/" className="hover:text-accent">
            Latest
          </Link>
          <Link href="/archive/" className="hover:text-accent">
            Archive
          </Link>
          <ThemeToggle />
        </nav>
      </div>
      <div className="mt-3 border-t-[3px] border-ink" />
      <div className="mt-[3px] border-t border-ink" />
      <Link href="/" className="block py-3 text-center sm:py-5">
        <span className="masthead font-display text-[clamp(2.6rem,11vw,8.75rem)] leading-[0.9]">
          The Hiero Ledger
        </span>
      </Link>
      <div className="border-t border-ink" />
      {dateline && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-2 text-center font-mono text-[0.7rem] uppercase tracking-[0.16em]">
          {dateline}
        </div>
      )}
      <div className="border-t border-ink" />
      <div className="mt-[3px] border-t-[3px] border-ink" />
    </header>
  );
}
