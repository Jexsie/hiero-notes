import Link from "next/link";
import { reposIn, type Briefing, type Section } from "@/lib/briefings";
import { colorForTitle } from "@/lib/repos";
import { Masthead } from "./Masthead";
import { Md } from "./Md";
import { RepoLens } from "./RepoLens";

type Neighbour = { slug: string; dateLabel: string } | null;

type Props = {
  briefing: Briefing;
  editionNo: number;
  older: Neighbour;
  newer: Neighbour;
};

const LETTERS = "ABCDEFGHIJ";

function delay(ms: number) {
  return { "--d": `${ms}ms` } as React.CSSProperties;
}

function topLevelItems(md: string): number {
  return md.split("\n").filter((l) => /^(?:[-*]|\d+\.) /.test(l)).length;
}

function sectionItems(s: Section): number {
  return topLevelItems(s.intro) + s.subsections.reduce((n, sub) => n + topLevelItems(sub.body), 0);
}

const NEWS_TONES: [RegExp, string, string][] = [
  [/discussion|idea/i, "ideas", "Ideas"],
  [/\bhips?\b/i, "hips", "Proposals"],
  [/being built/i, "building", "In progress"],
  [/shipped/i, "shipped", "Shipped"],
  [/deprecat|breaking|removed/i, "breaking", "Breaking"],
  [/changed/i, "changed", "Changed"],
];

function newsTone(title: string): [string, string] {
  const hit = NEWS_TONES.find(([re]) => re.test(title));
  return hit ? [hit[1], hit[2]] : ["other", "Elsewhere"];
}

function SectionHeader({ letter, section }: { letter: string; section: Section }) {
  const n = sectionItems(section);
  return (
    <header className="mb-6 grid grid-cols-[auto_1fr] items-end gap-x-4 border-b-[3px] border-double border-ink pb-2">
      <span className="font-display text-[3.5rem] leading-[0.8] text-accent sm:text-[4.5rem]">
        {letter}
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="font-display text-[1.9rem] leading-tight sm:text-[2.6rem]">{section.title}</h2>
        {n > 0 && (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            {n} {n === 1 ? "item" : "items"}
          </span>
        )}
      </div>
    </header>
  );
}

function SectionBody({ section }: { section: Section }) {
  switch (section.kind) {
    case "work":
      return (
        <>
          {section.intro && <Md className="md-work">{section.intro}</Md>}
          {section.subsections.map((sub) => (
            <div key={sub.id} id={sub.id} className="mt-6">
              <h3 className="kicker">{sub.title}</h3>
              <Md className="md-work">{sub.body}</Md>
            </div>
          ))}
        </>
      );

    case "contribute":
      return (
        <>
          {section.intro && <Md>{section.intro}</Md>}
          <div className="gap-x-8 md:columns-2">
            {section.subsections.map((sub) => (
              <div
                key={sub.id}
                id={sub.id}
                className="lot mb-10 break-inside-avoid"
                style={{ "--tone": colorForTitle(sub.title) ?? "var(--ink)" } as React.CSSProperties}
              >
                <h3 className="lot-title">{sub.title}</h3>
                <Md className="md-contribute">{sub.body}</Md>
              </div>
            ))}
          </div>
        </>
      );

    case "news":
      return (
        <>
          {section.intro && <Md>{section.intro}</Md>}
          {[true, false].map((wide) => (
            <div key={String(wide)} className={wide ? "" : "news-cols"}>
              {section.subsections
                .filter((sub) => sub.body.includes("|---") === wide)
                .map((sub) => {
                  const [tone, stamp] = newsTone(sub.title);
                  return (
                    <div key={sub.id} id={sub.id} className="news-sub" data-tone={tone}>
                      <div className="news-head mb-2 flex items-center gap-3">
                        <span className="stamp">{stamp}</span>
                        <h3 className="font-display text-[1.45rem] leading-tight">{sub.title}</h3>
                      </div>
                      <Md className="md-news">{sub.body}</Md>
                    </div>
                  );
                })}
            </div>
          ))}
        </>
      );

    case "focus":
      return (
        <>
          {section.intro && <Md>{section.intro}</Md>}
          <div className="grid gap-x-10 gap-y-12 lg:grid-cols-2">
            {section.subsections.map((sub) => (
              <div
                key={sub.id}
                id={sub.id}
                className="focus-card"
                style={{ "--tone": colorForTitle(sub.title) ?? "var(--ink)" } as React.CSSProperties}
              >
                <h3 className="font-display text-[1.7rem] leading-tight">{sub.title}</h3>
                <Md className="md-focus">{sub.body}</Md>
              </div>
            ))}
          </div>
        </>
      );

    case "background":
      return (
        <div className="mx-auto max-w-2xl text-center">
          <Md className="md-background">{section.intro}</Md>
        </div>
      );

    default:
      return (
        <>
          {section.intro && <Md>{section.intro}</Md>}
          {section.subsections.map((sub) => (
            <div key={sub.id} id={sub.id} className="mt-6">
              <h3 className="font-display text-[1.45rem]">{sub.title}</h3>
              <Md>{sub.body}</Md>
            </div>
          ))}
        </>
      );
  }
}

export function Edition({ briefing, editionNo, older, newer }: Props) {
  const [lead, ...rest] = briefing.tldr;
  const picks = briefing.sections
    .filter((s) => s.kind === "contribute")
    .reduce((n, s) => n + sectionItems(s), 0);
  const sections = briefing.sections.filter((s) => s.kind !== "background");
  const background = briefing.sections.find((s) => s.kind === "background");

  return (
    <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
      <Masthead
        editionNo={editionNo}
        dateline={
          <>
            <span>
              {briefing.weekday}, {briefing.dateLabel}
            </span>
            <span className="text-accent">◆</span>
            <span>{briefing.window}</span>
            <span className="text-accent">◆</span>
            <span>{briefing.refCount} references</span>
          </>
        }
      />

      <article id="edition" className="pb-24">
        {/* Front page */}
        <section className="grid gap-10 border-b border-ink py-8 lg:grid-cols-12 lg:gap-0">
          <div className="lg:col-span-8 lg:pr-10">
            <p className="kicker reveal" style={delay(80)}>
              Today&rsquo;s lead
            </p>
            {lead && (
              <div className="brief-lead reveal" style={delay(140)} data-repos={reposIn(lead)}>
                <Md className="md-lead">{lead}</Md>
              </div>
            )}
            {rest.length > 0 && (
              <ol className="mt-8 grid border-t border-ink md:grid-cols-2">
                {rest.map((item, i) => (
                  <li
                    key={i}
                    className="brief reveal"
                    style={delay(220 + i * 70)}
                    data-n={String(i + 2).padStart(2, "0")}
                    data-repos={reposIn(item)}
                  >
                    <Md className="md-brief">{item}</Md>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <aside className="reveal space-y-8 lg:col-span-4 lg:border-l lg:border-ink lg:pl-10" style={delay(300)}>
            <dl className="grid grid-cols-3 border-y border-ink text-center">
              <div className="py-3">
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">Refs</dt>
                <dd className="font-display text-[2.4rem] leading-none">{briefing.refCount}</dd>
              </div>
              <div className="border-x border-rule py-3">
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">Repos</dt>
                <dd className="font-display text-[2.4rem] leading-none">{briefing.repoCounts.length}</dd>
              </div>
              <div className="py-3">
                <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted">Picks</dt>
                <dd className="font-display text-[2.4rem] leading-none text-accent">{picks}</dd>
              </div>
            </dl>

            <nav aria-label="Sections">
              <p className="kicker">In this edition</p>
              <ol className="divide-y divide-rule border-y border-rule">
                {briefing.sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="toc-link">
                      <span className="font-display text-accent">{LETTERS[i]}</span>
                      <span>{s.title}</span>
                      <span className="font-mono text-[0.7rem] text-muted tabular-nums">
                        {sectionItems(s) || ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {briefing.notes.map((note, i) => (
              <div key={i} className="editor-note">
                <p className="kicker !mb-1">Editor&rsquo;s note</p>
                <Md className="md-note">{note}</Md>
              </div>
            ))}
          </aside>
        </section>

        {/* Sections, with the lens in the margin */}
        <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-20">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <SectionHeader letter={LETTERS[briefing.sections.indexOf(s)]} section={s} />
                <SectionBody section={s} />
              </section>
            ))}
          </div>
          <aside className="order-first lg:order-none">
            <div className="lg:sticky lg:top-6">
              <RepoLens counts={briefing.repoCounts} target="edition" />
            </div>
          </aside>
        </div>

        {background && (
          <section id={background.id} className="mt-20 border-t-[3px] border-double border-ink pt-8">
            <p className="text-center font-display text-3xl text-accent">⁂</p>
            <SectionBody section={background} />
          </section>
        )}

        <nav className="mt-16 grid grid-cols-2 border-y border-ink font-mono text-[0.72rem] uppercase tracking-[0.14em]">
          <div className="py-4 pr-4">
            {older && (
              <Link href={`/editions/${older.slug}/`} className="group block">
                <span className="text-muted">← Previous edition</span>
                <span className="mt-1 block font-display text-lg normal-case tracking-normal group-hover:text-accent">
                  {older.dateLabel}
                </span>
              </Link>
            )}
          </div>
          <div className="border-l border-ink py-4 pl-4 text-right">
            {newer && (
              <Link href={`/editions/${newer.slug}/`} className="group block">
                <span className="text-muted">Next edition →</span>
                <span className="mt-1 block font-display text-lg normal-case tracking-normal group-hover:text-accent">
                  {newer.dateLabel}
                </span>
              </Link>
            )}
          </div>
        </nav>
      </article>
    </div>
  );
}
