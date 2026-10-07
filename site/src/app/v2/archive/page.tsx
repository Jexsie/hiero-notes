import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/v2/TopBar";
import { getBriefings, headline, plain } from "@/lib/briefings";

export const metadata: Metadata = { title: "Signal · Archive" };

const WEEKS = 16;
const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SignalArchive() {
  const all = getBriefings();
  const byDate = new Map<string, (typeof all)[number]>();
  for (const b of all) if (!byDate.has(b.date)) byDate.set(b.date, b);
  const max = Math.max(1, ...all.map((b) => b.refCount));

  // Calendar ending on the Sunday of the newest edition's week.
  const last = new Date(`${all[0]?.date ?? iso(new Date())}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + ((7 - last.getUTCDay()) % 7));
  const start = new Date(last);
  start.setUTCDate(start.getUTCDate() - WEEKS * 7 + 1);
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + w * 7 + d);
      return day;
    }),
  );

  return (
    <div className="sig">
      <TopBar classicHref="/archive/" />
      <main className="mx-auto max-w-[1680px] space-y-4 px-3 py-5 sm:px-5">
        <div className="fade">
          <p className="label">archive · {all.length} editions on file</p>
          <h1 className="cond text-[clamp(3rem,8vw,6.5rem)] font-extrabold uppercase leading-[0.85] tracking-tight">
            Back <span className="text-[var(--sig)]">signal</span>
          </h1>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <b>▦</b> Activity · last {WEEKS} weeks
            </h2>
            <span className="label flex items-center gap-1.5">
              fewer
              {[0.15, 0.4, 0.7, 1].map((o) => (
                <span key={o} className="h-2.5 w-2.5" style={{ background: "var(--sig)", opacity: o }} />
              ))}
              more refs
            </span>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="inline-grid grid-flow-col gap-1" style={{ gridTemplateRows: "repeat(8, auto)" }}>
              <span />
              {DAYS.map((d, i) => (
                <span key={i} className="label pr-2 text-[0.58rem] leading-[1.15rem]">
                  {d}
                </span>
              ))}
              {weeks.map((week, w) => (
                <div key={w} className="contents">
                  <span className="label h-4 text-[0.58rem]">
                    {week[0].getUTCDate() <= 7
                      ? week[0].toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
                      : ""}
                  </span>
                  {week.map((day) => {
                    const b = byDate.get(iso(day));
                    const cell = "block h-[1.15rem] w-[1.15rem]";
                    return b ? (
                      <Link
                        key={iso(day)}
                        href={`/v2/editions/${b.slug}/`}
                        title={`${b.dateLabel}: ${b.refCount} refs`}
                        className={`${cell} outline-offset-1 hover:outline hover:outline-2 hover:outline-[var(--fg)]`}
                        style={{ background: "var(--sig)", opacity: 0.25 + 0.75 * (b.refCount / max) }}
                      />
                    ) : (
                      <span key={iso(day)} className={`${cell} border border-[var(--line)]`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <b>≡</b> Log
            </h2>
            <span className="label">newest first</span>
          </div>
          <ol>
            {all.map((b, i) => {
              const total = b.repoCounts.reduce((n, c) => n + c.count, 0) || 1;
              const lead = b.tldr[0] ? headline(b.tldr[0]) : null;
              return (
                <li key={b.slug} className="fade border-b border-[var(--line)] last:border-b-0" style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
                  <Link
                    href={`/v2/editions/${b.slug}/`}
                    className="grid gap-x-6 gap-y-2 px-4 py-3 hover:bg-[var(--panel-2)] md:grid-cols-[7rem_5rem_1fr_14rem]"
                  >
                    <span className="mono text-[0.8rem] text-[var(--sig)]">{b.date}</span>
                    <span className="label pt-0.5">
                      ED-{String(all.length - i).padStart(3, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="cond line-clamp-2 block text-[1.2rem] font-bold leading-tight">
                        {lead?.head && lead.head.length > 24 ? lead.head : plain(b.tldr[0] ?? b.title)}
                      </span>
                      <span className="block truncate text-[0.85rem] text-[var(--dim)]">
                        {b.tldr.length} priority items · {b.window}
                      </span>
                    </span>
                    <span className="self-center">
                      <span className="flex h-2 gap-px overflow-hidden">
                        {b.repoCounts.map((c) => (
                          <span key={c.repo} style={{ width: `${(c.count / total) * 100}%`, background: c.color }} />
                        ))}
                      </span>
                      <span className="label mt-1 block">{b.refCount} refs</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
