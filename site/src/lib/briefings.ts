import fs from "node:fs";
import path from "node:path";
import { repoFromUrl, repoMeta } from "./repos";

export type SectionKind = "work" | "contribute" | "news" | "focus" | "background" | "generic";

export type Subsection = { id: string; title: string; body: string };

export type Section = {
  id: string;
  title: string;
  kind: SectionKind;
  intro: string;
  subsections: Subsection[];
};

export type RepoCount = { repo: string; label: string; color: string; focus: boolean; count: number };

export type Briefing = {
  slug: string;
  date: string;
  dateLabel: string;
  weekday: string;
  window: string;
  title: string;
  notes: string[];
  tldr: string[];
  sections: Section[];
  repoCounts: RepoCount[];
  refCount: number;
};

const BRIEFINGS_DIR =
  process.env.BRIEFINGS_DIR ?? path.join(process.cwd(), "..", "briefings");

const SLUG = /^(\d{4}-\d{2}-\d{2})(?:-([\w-]+))?$/;
const GITHUB_URL = /https:\/\/github\.com\/hiero-ledger\/[^\s)\]>]+/g;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function kindOf(title: string): SectionKind {
  if (/your work/i.test(title)) return "work";
  if (/contribute/i.test(title)) return "contribute";
  if (/everything going on/i.test(title)) return "news";
  if (/focus repos/i.test(title)) return "focus";
  if (/background/i.test(title)) return "background";
  return "generic";
}

/** Collect bullet items, folding indented continuation lines into the item above. */
function bulletItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    if (/^[-*] /.test(line)) items.push(line.slice(2).trim());
    else if (items.length && /^\s+\S/.test(line)) items[items.length - 1] += "\n" + line;
  }
  return items;
}

function parse(slug: string, markdown: string): Briefing {
  const match = slug.match(SLUG);
  const date = match?.[1] ?? slug;
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const valid = !Number.isNaN(parsedDate.getTime());

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const title = lines.find((l) => l.startsWith("# "))?.slice(2).trim() ?? slug;
  const window =
    title.match(/\(([^)]+)\)\s*$/)?.[1] ?? (match?.[2] ? match[2] : "daily");

  const firstSection = lines.findIndex((l) => l.startsWith("## "));
  const preamble = lines.slice(0, firstSection === -1 ? lines.length : firstSection);

  const notes: string[] = [];
  let quote: string[] = [];
  for (const line of preamble) {
    if (line.startsWith(">")) quote.push(line.replace(/^>\s?/, ""));
    else if (quote.length) {
      notes.push(quote.join("\n"));
      quote = [];
    }
  }
  if (quote.length) notes.push(quote.join("\n"));

  const tldrStart = preamble.findIndex((l) => /TL;DR/i.test(l));
  const tldr = tldrStart === -1 ? [] : bulletItems(preamble.slice(tldrStart + 1));

  const sections: Section[] = [];
  if (firstSection !== -1) {
    let current: { title: string; lines: string[] } | null = null;
    const flush = () => {
      if (!current) return;
      const body = current.lines;
      const firstSub = body.findIndex((l) => l.startsWith("### "));
      const intro = (firstSub === -1 ? body : body.slice(0, firstSub)).join("\n").trim();
      const subsections: Subsection[] = [];
      if (firstSub !== -1) {
        let sub: { title: string; lines: string[] } | null = null;
        for (const line of body.slice(firstSub)) {
          if (line.startsWith("### ")) {
            if (sub) subsections.push(toSub(current.title, sub));
            sub = { title: line.slice(4).trim(), lines: [] };
          } else sub?.lines.push(line);
        }
        if (sub) subsections.push(toSub(current.title, sub));
      }
      sections.push({
        id: slugify(current.title),
        title: current.title,
        kind: kindOf(current.title),
        intro,
        subsections,
      });
    };
    for (const line of lines.slice(firstSection)) {
      if (line.startsWith("## ")) {
        flush();
        current = { title: line.slice(3).trim(), lines: [] };
      } else current?.lines.push(line);
    }
    flush();
  }

  const urls = new Set(
    (markdown.match(GITHUB_URL) ?? []).map((u) => u.replace(/[.,;:]+$/, "")),
  );
  const counts = new Map<string, number>();
  for (const url of urls) {
    const repo = repoFromUrl(url);
    if (repo) counts.set(repo, (counts.get(repo) ?? 0) + 1);
  }
  const repoCounts = [...counts.entries()]
    .map(([repo, count]) => ({ repo, count, ...repoMeta(repo) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    slug,
    date,
    dateLabel: valid
      ? parsedDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : date,
    weekday: valid
      ? parsedDate.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })
      : "",
    window,
    title,
    notes,
    tldr,
    sections,
    repoCounts,
    refCount: urls.size,
  };
}

function toSub(parent: string, sub: { title: string; lines: string[] }): Subsection {
  return {
    id: `${slugify(parent)}--${slugify(sub.title)}`,
    title: sub.title,
    body: sub.lines.join("\n").trim(),
  };
}

/** All briefings, newest first. Read synchronously at build time. */
export function getBriefings(): Briefing[] {
  if (!fs.existsSync(BRIEFINGS_DIR)) return [];
  return fs
    .readdirSync(BRIEFINGS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3))
    .filter((slug) => SLUG.test(slug))
    .sort((a, b) => b.localeCompare(a))
    .map((slug) => parse(slug, fs.readFileSync(path.join(BRIEFINGS_DIR, `${slug}.md`), "utf8")));
}

/** Plain-text version of a markdown snippet, for excerpts. */
export function plain(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A briefing with its position in the run of editions. */
export function getEdition(slug?: string) {
  const all = getBriefings();
  const i = slug ? all.findIndex((b) => b.slug === slug) : 0;
  if (i === -1 || !all[i]) return null;
  const pick = (b?: Briefing) => (b ? { slug: b.slug, dateLabel: b.dateLabel } : null);
  return {
    briefing: all[i],
    editionNo: all.length - i,
    older: pick(all[i + 1]),
    newer: pick(all[i - 1]),
  };
}

/** Repos linked from a markdown snippet, space-separated (for data-repos). */
export function reposIn(md: string): string | undefined {
  const repos = new Set(
    (md.match(GITHUB_URL) ?? []).map(repoFromUrl).filter((r): r is string => r !== null),
  );
  return repos.size ? [...repos].join(" ") : undefined;
}

export type Ticket = {
  /** Markdown of the first line (the suggestion itself). */
  title: string;
  /** Labelled sub-bullets such as "Why you", "Status", "First step", "Size". */
  fields: { key: string; value: string }[];
  /** Unlabelled sub-bullets. */
  notes: string[];
  repos?: string;
};

/**
 * Splits a "Where you can contribute" subsection into numbered suggestions with their
 * labelled fields (`- *Why you:* ...`). Bullets that aren't numbered come back as `loose`.
 */
export function parseTickets(body: string): { tickets: Ticket[]; loose: string[] } {
  const tickets: Ticket[] = [];
  const loose: string[] = [];
  let current: Ticket | null = null;
  for (const line of body.split("\n")) {
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    const sub = line.match(/^\s+[-*]\s+(.*)$/);
    if (numbered) {
      current = { title: numbered[1], fields: [], notes: [] };
      tickets.push(current);
    } else if (sub && current) {
      const field = sub[1].match(/^\*([^*]+?):\*\s*(.*)$/);
      if (field) current.fields.push({ key: field[1].trim(), value: field[2] });
      else current.notes.push(sub[1]);
    } else if (/^[-*]\s+/.test(line)) {
      current = null;
      loose.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() && current) {
      current.title += " " + line.trim();
    }
  }
  for (const t of tickets) t.repos = reposIn(t.title);
  return { tickets, loose };
}

/** Splits a leading **bold** phrase from the rest of a markdown snippet. */
export function headline(md: string): { head: string | null; rest: string } {
  const m = md.match(/^\*\*(.+?)\*\*[:.]?\s*/);
  return m ? { head: m[1].replace(/[:.]$/, ""), rest: md.slice(m[0].length) } : { head: null, rest: md };
}

/** Rough size from a "Size:" field, on a 1–5 scale (S, S–M, M, M–L, L). */
export function sizeLevel(value: string): { level: number; label: string } | null {
  const v = value.toLowerCase();
  const s = v.includes("small"), m = v.includes("medium"), l = v.includes("large");
  if (s && m) return { level: 2, label: "S–M" };
  if (m && l) return { level: 4, label: "M–L" };
  if (s) return { level: 1, label: "S" };
  if (m) return { level: 3, label: "M" };
  if (l) return { level: 5, label: "L" };
  return null;
}

export const NEWS_TONES: [RegExp, string, string][] = [
  [/discussion|idea/i, "ideas", "Ideas"],
  [/\bhips?\b/i, "hips", "Proposals"],
  [/being built/i, "building", "In progress"],
  [/shipped/i, "shipped", "Shipped"],
  [/deprecat|breaking|removed/i, "breaking", "Breaking"],
  [/changed/i, "changed", "Changed"],
];

export function newsTone(title: string): [string, string] {
  const hit = NEWS_TONES.find(([re]) => re.test(title));
  return hit ? [hit[1], hit[2]] : ["other", "Elsewhere"];
}
