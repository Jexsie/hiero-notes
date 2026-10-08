/** Data model for the Pulse dashboard. Raw shape is written by scripts/fetch_pulse.py. */

export type RawRepo = {
  o: string;
  n: string;
  d: string;
  lang: string | null;
  stars: number;
  pushed: string;
  fork: boolean;
  oi: number;
  op: number;
  rel: [tag: string, date: string, url: string, pre: boolean][];
};

type RawIssue = {
  r: number; n: number; t: string; c: string; u: string; x: string | null;
  au: string | null; b: 0 | 1; k: number; a: string[]; l: number[];
};

type RawPr = {
  r: number; n: number; t: string; c: string; u: string; x: string | null; m: string | null;
  d: 0 | 1; rv: "A" | "C" | "R" | null; ad: number; de: number;
  au: string | null; b: 0 | 1; rr: string[]; l: number[];
};

export type RawPulse = {
  generatedAt: string;
  windowDays: number;
  cutoff: string;
  user: string;
  orgs: string[];
  repos: RawRepo[];
  labels: string[];
  issues: RawIssue[];
  prs: RawPr[];
};

export type GroupKey = "sdk" | "network" | "tooling" | "community" | "identity" | "clpr";

/** Fixed group order = fixed categorical slot order (validated palette, see pulse.css). */
export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "sdk", label: "SDKs" },
  { key: "network", label: "Network" },
  { key: "tooling", label: "Tooling" },
  { key: "community", label: "Community" },
  { key: "identity", label: "Identity" },
  { key: "clpr", label: "CLPR" },
];

export const FOCUS = new Set([
  "hiero-ledger/hiero-sdk-js",
  "hiero-ledger/hiero-sdk-tck",
  "hiero-ledger/hiero-sdk-java",
  "hiero-ledger/solo",
  "hiero-ledger/hiero-solo-action",
  "hiero-ledger/hiero-json-rpc-relay",
]);

const SHORT: Record<string, string> = {
  "hiero-sdk-js": "JS SDK",
  "hiero-sdk-java": "Java SDK",
  "hiero-sdk-go": "Go SDK",
  "hiero-sdk-python": "Python SDK",
  "hiero-sdk-rust": "Rust SDK",
  "hiero-sdk-cpp": "C++ SDK",
  "hiero-sdk-swift": "Swift SDK",
  "hiero-sdk-tck": "TCK",
  "hiero-solo-action": "Solo Action",
  "hiero-json-rpc-relay": "Relay",
  "hiero-consensus-node": "Consensus Node",
  "hiero-mirror-node": "Mirror Node",
  "hiero-block-node": "Block Node",
  "hiero-mirror-node-explorer": "Explorer",
  "hiero-improvement-proposals": "HIPs",
  "sdk-collaboration-hub": "SDK hub",
  "hiero-local-node": "Local Node",
  "hiero-cli": "CLI",
};

function groupOf(org: string, name: string): GroupKey {
  if (org !== "hiero-ledger") return "clpr";
  if (/^hiero-sdk-|^sdk-collaboration-hub$|^hiero-enterprise-java$/.test(name)) return "sdk";
  if (/identity|did-sdk|heka/.test(name)) return "identity";
  if (/^solo|^hiero-solo-action$|^hiero-cli$|^hiero-local-node$|gradle|homebrew/.test(name)) return "tooling";
  if (/consensus|mirror|block-node|json-rpc|cryptography|contracts|ethereum|hederium/.test(name)) return "network";
  return "community";
}

export type Repo = {
  i: number;
  id: string;
  org: string;
  name: string;
  short: string;
  group: GroupKey;
  focus: boolean;
  description: string;
  language: string | null;
  pushed: number;
  openIssues: number;
  openPrs: number;
  releases: { tag: string; at: number; url: string; pre: boolean }[];
  url: string;
};

export type Issue = {
  kind: "issue";
  repo: number;
  number: number;
  title: string;
  created: number;
  updated: number;
  closed: number | null;
  author: string | null;
  bot: boolean;
  comments: number;
  assignees: string[];
  labels: string[];
  url: string;
};

export type ReviewState = "approved" | "changes" | "waiting";

export type Pr = {
  kind: "pr";
  repo: number;
  number: number;
  title: string;
  created: number;
  updated: number;
  closed: number | null;
  merged: number | null;
  draft: boolean;
  review: ReviewState;
  size: number;
  author: string | null;
  bot: boolean;
  requested: string[];
  labels: string[];
  url: string;
};

export type Item = Issue | Pr;

export type Pulse = {
  generatedAt: number;
  windowDays: number;
  user: string;
  repos: Repo[];
  issues: Issue[];
  prs: Pr[];
};

const t = (s: string) => Date.parse(s.endsWith("Z") ? s : s + "Z");

export function decode(raw: RawPulse): Pulse {
  const repos: Repo[] = raw.repos.map((r, i) => ({
    i,
    id: `${r.o}/${r.n}`,
    org: r.o,
    name: r.n,
    short: r.o === "hiero-ledger" ? SHORT[r.n] ?? r.n.replace(/^hiero-/, "") : `clpr/${r.n.replace(/^clpr-/, "")}`,
    group: groupOf(r.o, r.n),
    focus: FOCUS.has(`${r.o}/${r.n}`),
    description: r.d,
    language: r.lang,
    pushed: t(r.pushed),
    openIssues: r.oi,
    openPrs: r.op,
    releases: r.rel.map(([tag, at, url, pre]) => ({ tag, at: t(at), url, pre })),
    url: `https://github.com/${r.o}/${r.n}`,
  }));
  const labels = raw.labels;
  // GitHub logins are case-insensitive; use the casing the data actually has.
  const wanted = raw.user.toLowerCase();
  const user =
    [...raw.prs, ...raw.issues]
      .flatMap((x) => [x.au, ...("a" in x ? x.a : x.rr)])
      .find((login) => login?.toLowerCase() === wanted) ?? raw.user;
  return {
    generatedAt: t(raw.generatedAt),
    windowDays: raw.windowDays,
    user,
    repos,
    issues: raw.issues.map((x) => ({
      kind: "issue",
      repo: x.r,
      number: x.n,
      title: x.t,
      created: t(x.c),
      updated: t(x.u),
      closed: x.x ? t(x.x) : null,
      author: x.au,
      bot: !!x.b,
      comments: x.k,
      assignees: x.a,
      labels: x.l.map((l) => labels[l]),
      url: `${repos[x.r].url}/issues/${x.n}`,
    })),
    prs: raw.prs.map((x) => ({
      kind: "pr",
      repo: x.r,
      number: x.n,
      title: x.t,
      created: t(x.c),
      updated: t(x.u),
      closed: x.x ? t(x.x) : null,
      merged: x.m ? t(x.m) : null,
      draft: !!x.d,
      review: x.rv === "A" ? "approved" : x.rv === "C" ? "changes" : "waiting",
      size: x.ad + x.de,
      author: x.au,
      bot: !!x.b,
      requested: x.rr,
      labels: x.l.map((l) => labels[l]),
      url: `${repos[x.r].url}/pull/${x.n}`,
    })),
  };
}

export const DAY = 86_400_000;

export function dayIndex(ts: number, start: number): number {
  return Math.floor((ts - start) / DAY);
}

/** Number of items open at time `at`, reconstructed from created/closed dates. */
export function openAt(items: { created: number; closed: number | null }[], at: number): number {
  let n = 0;
  for (const it of items) if (it.created <= at && (it.closed === null || it.closed > at)) n++;
  return n;
}

export const AGE_BUCKETS = [
  { key: "w", label: "< 1 week", max: 7 },
  { key: "m", label: "1–4 weeks", max: 30 },
  { key: "q", label: "1–3 months", max: 90 },
  { key: "y", label: "3–12 months", max: 365 },
  { key: "old", label: "> 1 year", max: Infinity },
] as const;

export function ageBucket(days: number): number {
  return AGE_BUCKETS.findIndex((b) => days < b.max);
}

export function fmtAge(ms: number): string {
  const d = ms / DAY;
  if (d < 1) return `${Math.max(1, Math.round(d * 24))}h`;
  if (d < 60) return `${Math.round(d)}d`;
  if (d < 730) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function compact(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(0)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}
