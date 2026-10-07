import Link from "next/link";
import {
  headline,
  plain,
  newsTone,
  parseTickets,
  reposIn,
  sizeLevel,
  type Briefing,
  type Section,
  type Ticket,
} from "@/lib/briefings";
import { colorForTitle, repoMeta } from "@/lib/repos";
import { Md } from "../Md";
import { RepoFilter } from "./RepoFilter";
import { Tabs } from "./Tabs";
import { TopBar } from "./TopBar";

type Neighbour = { slug: string; dateLabel: string } | null;

type Props = {
  briefing: Briefing;
  editionNo: number;
  older: Neighbour;
  newer: Neighbour;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function delay(ms: number) {
  return { "--d": `${ms}ms` } as React.CSSProperties;
}

function count(md: string) {
  return md.split("\n").filter((l) => /^(?:[-*]|\d+\.) /.test(l)).length;
}

function RepoChips({ repos }: { repos?: string }) {
  if (!repos) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {repos.split(" ").map((r) => {
        const m = repoMeta(r);
        return (
          <span key={r} className="chip" style={{ "--c": m.focus ? m.color : "var(--dim)" } as React.CSSProperties}>
            {m.label}
          </span>
        );
      })}
    </span>
  );
}

function SizeMeter({ value }: { value: string }) {
  const size = sizeLevel(value);
  if (!size) return null;
  return (
    <span className="flex items-center gap-2" title={value}>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="h-2.5 w-2"
            style={{ background: n <= size.level ? "var(--tone)" : "var(--line)" }}
          />
        ))}
      </span>
      <span className="mono text-[0.68rem]">{size.label}</span>
    </span>
  );
}

function TicketCard({ ticket, code }: { ticket: Ticket; code: string }) {
  const size = ticket.fields.find((f) => /^size$/i.test(f.key));
  const fields = ticket.fields.filter((f) => f !== size);
  const isReview = /^\*\*review/i.test(ticket.title);
  return (
    <article className="ticket border border-[var(--line)] bg-[var(--bg)]" data-repos={ticket.repos}>
      <header className="flex items-center justify-between gap-2 border-b border-dashed border-[var(--line)] px-3 py-1.5">
        <span className="mono text-[0.66rem] text-[var(--tone)]">{code}</span>
        <span className="flex items-center gap-3">
          {isReview && (
            <span className="chip" style={{ "--c": "var(--t-building)" } as React.CSSProperties}>
              review
            </span>
          )}
          {size && <SizeMeter value={size.value} />}
        </span>
      </header>
      <div className="px-3 py-2.5">
        <Md className="text-[0.98rem] leading-snug">{ticket.title}</Md>
        {fields.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[0.86rem]">
            {fields.map((f) => (
              <div key={f.key} className="contents">
                <dt className="label pt-[0.2rem]">{f.key}</dt>
                <dd className="min-w-0">
                  <Md>{f.value}</Md>
                </dd>
              </div>
            ))}
          </dl>
        )}
        {ticket.notes.length > 0 && (
          <Md className="mt-2 text-[0.86rem]">{ticket.notes.map((n) => `- ${n}`).join("\n")}</Md>
        )}
      </div>
    </article>
  );
}

function Panel({
  title,
  accent,
  meta,
  children,
  className = "",
  id,
}: {
  title: string;
  accent: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`panel scroll-mt-16 ${className}`}>
      <div className="panel-head">
        <h2>
          <b>{accent}</b> {title}
        </h2>
        {meta && <span className="label">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Contribute({ section }: { section: Section }) {
  let n = 0;
  return (
    <div className="grid grid-cols-1 gap-px bg-[var(--line)] md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
      {section.subsections.map((sub) => {
        const { tickets, loose } = parseTickets(sub.body);
        const color = colorForTitle(sub.title) ?? "var(--sig)";
        return (
          <div
            key={sub.id}
            id={sub.id}
            className="bg-[var(--panel)] p-3"
            style={{ "--tone": color } as React.CSSProperties}
          >
            <h3 className="mb-2.5 flex items-center gap-2">
              <span className="led" style={{ "--c": color } as React.CSSProperties} />
              <span className="cond text-[1.15rem] font-bold uppercase tracking-wide">{sub.title}</span>
              <span className="label ml-auto">{tickets.length || loose.length} open</span>
            </h3>
            <div className="space-y-2">
              {tickets.map((t, i) => (
                <TicketCard key={i} ticket={t} code={`T-${String(++n).padStart(2, "0")}`} />
              ))}
              {loose.length > 0 && (
                <Md className="text-[0.9rem]">{loose.map((l) => `- ${l}`).join("\n")}</Md>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Board({ briefing, editionNo, older, newer }: Props) {
  const find = (kind: Section["kind"]) => briefing.sections.find((s) => s.kind === kind);
  const work = find("work");
  const contribute = find("contribute");
  const news = find("news");
  const focus = find("focus");
  const background = find("background");

  const picks = contribute
    ? contribute.subsections.reduce((n, s) => n + parseTickets(s.body).tickets.length, 0)
    : 0;
  const tables = news?.subsections.filter((s) => s.body.includes("|---")) ?? [];
  const wire = news?.subsections.filter((s) => !s.body.includes("|---")) ?? [];
  const [y, m, d] = briefing.date.split("-");
  const code = `ED-${String(editionNo).padStart(3, "0")}`;

  const metrics = [
    { k: "refs", v: briefing.refCount },
    { k: "repos", v: briefing.repoCounts.length },
    { k: "picks", v: picks, hot: true },
    { k: "queue", v: work ? count(work.intro) : 0 },
    { k: "wire", v: wire.reduce((n, s) => n + count(s.body), 0) },
  ];

  return (
    <div className="sig">
      <TopBar code={code} window={briefing.window} classicHref={`/editions/${briefing.slug}/`} />

      <main id="board" className="mx-auto max-w-[1680px] space-y-4 px-3 py-5 sm:px-5">
        {/* Header */}
        <div className="grid items-end gap-4 lg:grid-cols-[1fr_auto]">
          <div className="fade" style={delay(0)}>
            <p className="label">
              {code} · {briefing.window} · {y}
            </p>
            <h1 className="cond text-[clamp(3.2rem,9vw,7.5rem)] font-extrabold uppercase leading-[0.85] tracking-tight">
              {briefing.weekday.slice(0, 3)} <span className="text-[var(--sig)]">{d}</span>{" "}
              {MONTHS[Number(m) - 1]}
            </h1>
          </div>
          <dl className="fade grid grid-cols-5 gap-px border border-[var(--line)] bg-[var(--line)]" style={delay(120)}>
            {metrics.map((x) => (
              <div key={x.k} className="min-w-0 bg-[var(--panel)] px-2 py-2.5 sm:px-4">
                <dt className="label truncate">{x.k}</dt>
                <dd
                  className={`cond text-[1.8rem] font-bold sm:text-[2.4rem] leading-none tabular-nums ${
                    x.hot ? "text-[var(--sig)]" : ""
                  }`}
                >
                  {String(x.v).padStart(2, "0")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {briefing.notes.map((note, i) => (
          <div key={i} className="fade flex gap-3 border border-dashed border-[var(--sig)] bg-[var(--sig-soft)] px-3 py-2 text-[0.88rem]" style={delay(160)}>
            <span className="label !text-[var(--sig)]">sys</span>
            <Md>{note}</Md>
          </div>
        ))}

        <div className="fade" style={delay(200)}>
          <RepoFilter counts={briefing.repoCounts} target="board" />
        </div>

        {/* Departure board */}
        <Panel title="Priority board · TL;DR" accent="▲" meta={`${briefing.tldr.length} items`}>
          <ol>
            {briefing.tldr.map((item, i) => {
              const { head, rest } = headline(item);
              return (
                <li
                  key={i}
                  className="row flip grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-[var(--line)] px-3 py-3 last:border-b-0 md:grid-cols-[3rem_10rem_minmax(0,1fr)]"
                  style={delay(260 + i * 90)}
                  data-repos={reposIn(item)}
                >
                  <span className="mono pt-0.5 text-[1.05rem] text-[var(--sig)]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hidden md:block">
                    <RepoChips repos={reposIn(item)} />
                  </span>
                  <div className="min-w-0">
                    {head && <Md className="cond text-[1.35rem] font-bold leading-tight">{head}</Md>}
                    <Md className="mt-0.5 text-[0.92rem] text-[var(--dim)]">{rest}</Md>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="min-w-0 space-y-4 xl:col-span-7">
            {work && (
              <Panel id={work.id} title="Your queue" accent="◆" meta={`${count(work.intro)} items`}>
                <Md className="md-queue px-4 py-3 text-[0.95rem]">{work.intro}</Md>
              </Panel>
            )}
            {contribute && (
              <Panel id={contribute.id} title="Open tickets · where you can contribute" accent="+" meta={`${picks} tickets`}>
                <Contribute section={contribute} />
              </Panel>
            )}
          </div>

          <div className="min-w-0 space-y-4 xl:col-span-5">
            {tables.map((t) => {
              const [tone] = newsTone(t.title);
              return (
                <Panel key={t.id} id={t.id} title={t.title} accent="≡" meta={`${count(t.body) || ""}`}>
                  <div data-tone={tone}>
                    <Md>{t.body}</Md>
                  </div>
                </Panel>
              );
            })}
            {news && (
              <Panel id={news.id} title="Wire · everything going on" accent="⌁" meta={<span className="flex items-center gap-2"><span className="led pulse" />live</span>}>
                <Tabs
                  tabs={wire.map((s) => {
                    const [tone, label] = newsTone(s.title);
                    return { label, count: count(s.body), color: `var(--t-${tone})` };
                  })}
                >
                  {wire.map((s) => {
                    const [tone] = newsTone(s.title);
                    return (
                      <div key={s.id} id={s.id} data-tone={tone} className="border-b border-[var(--line)] px-4 py-3 last:border-b-0" style={{ boxShadow: "inset 3px 0 0 var(--tone)" }}>
                        <h3 className="label mb-2 !text-[var(--tone)]">{s.title}</h3>
                        <Md className="text-[0.9rem]">{s.body}</Md>
                      </div>
                    );
                  })}
                </Tabs>
              </Panel>
            )}
          </div>
        </div>

        {focus && (
          <Panel id={focus.id} title="Systems · focus repos" accent="◉" meta={`${focus.subsections.length} modules`}>
            <div className="grid grid-cols-1 gap-px bg-[var(--line)] md:grid-cols-2 2xl:grid-cols-3">
              {focus.subsections.map((sub) => {
                const color = colorForTitle(sub.title) ?? "var(--sig)";
                return (
                  <div key={sub.id} id={sub.id} className="bg-[var(--panel)] p-4" style={{ "--tone": color } as React.CSSProperties}>
                    <h3 className="mb-1 flex items-center gap-2">
                      <span className="led" style={{ "--c": color } as React.CSSProperties} />
                      <span className="cond text-[1.4rem] font-bold uppercase tracking-wide">{sub.title}</span>
                    </h3>
                    <Md className="md-mod text-[0.88rem]">{sub.body}</Md>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {background && (
          <p className="mono border-t border-[var(--line)] pt-3 text-[0.72rem] text-[var(--dim)]">
            &gt; {plain(background.intro)}
          </p>
        )}

        <nav className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)]">
          <div className="bg-[var(--panel)] p-3">
            {older && (
              <Link href={`/v2/editions/${older.slug}/`} className="block hover:text-[var(--sig)]">
                <span className="label">◂ prev</span>
                <span className="cond block text-lg font-bold uppercase">{older.dateLabel}</span>
              </Link>
            )}
          </div>
          <div className="bg-[var(--panel)] p-3 text-right">
            {newer && (
              <Link href={`/v2/editions/${newer.slug}/`} className="block hover:text-[var(--sig)]">
                <span className="label">next ▸</span>
                <span className="cond block text-lg font-bold uppercase">{newer.dateLabel}</span>
              </Link>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}
