import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { getBriefings, plain } from "@/lib/briefings";

export const metadata: Metadata = { title: "Archive" };

export default function Archive() {
  const all = getBriefings();
  return (
    <div className="mx-auto max-w-[88rem] px-4 pb-24 sm:px-8">
      <Masthead
        dateline={
          <span>
            {all.length} {all.length === 1 ? "edition" : "editions"} on file
          </span>
        }
      />
      <ol className="mt-10">
        {all.map((b, i) => {
          const total = b.repoCounts.reduce((n, c) => n + c.count, 0) || 1;
          const [day, ...monthYear] = b.dateLabel.split(" ");
          return (
            <li
              key={b.slug}
              className="reveal border-b border-ink"
              style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
            >
              <Link
                href={`/editions/${b.slug}/`}
                className="group grid gap-x-8 gap-y-3 py-7 md:grid-cols-[9rem_1fr_16rem]"
              >
                <div className="flex items-baseline gap-3 md:block">
                  <span className="font-display text-[4.5rem] leading-[0.85] group-hover:text-accent">
                    {day}
                  </span>
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted md:mt-2 md:block">
                    {b.weekday.slice(0, 3)} · {monthYear.join(" ")}
                  </span>
                </div>
                <div>
                  <p className="kicker !mb-1">
                    No. {all.length - i} · {b.window}
                  </p>
                  <p className="font-display text-[1.55rem] leading-snug group-hover:underline group-hover:decoration-accent group-hover:decoration-2 group-hover:underline-offset-4">
                    {plain(b.tldr[0] ?? b.title)}
                  </p>
                  {b.tldr.length > 1 && (
                    <p className="mt-2 line-clamp-2 text-[0.95rem] text-muted">
                      Also: {b.tldr.slice(1).map((t) => plain(t).split(/[.:](?:\s|$)/)[0]).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="self-center">
                  <div className="flex h-3 w-full overflow-hidden border border-ink" aria-hidden>
                    {b.repoCounts.map((c) => (
                      <span
                        key={c.repo}
                        title={`${c.label}: ${c.count}`}
                        style={{ width: `${(c.count / total) * 100}%`, background: c.color }}
                        className="border-r border-paper last:border-r-0"
                      />
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted">
                    {b.refCount} refs ·{" "}
                    {b.repoCounts
                      .slice(0, 3)
                      .map((c) => c.label)
                      .join(", ")}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
