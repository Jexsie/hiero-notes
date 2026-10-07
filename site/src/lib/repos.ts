export type RepoMeta = { label: string; color: string; focus: boolean };

const KNOWN: Record<string, Omit<RepoMeta, "focus"> & { focus?: boolean }> = {
  "hiero-sdk-js": { label: "JS SDK", color: "var(--r-js)", focus: true },
  "hiero-sdk-java": { label: "Java SDK", color: "var(--r-java)", focus: true },
  "hiero-sdk-tck": { label: "TCK", color: "var(--r-tck)", focus: true },
  solo: { label: "Solo", color: "var(--r-solo)", focus: true },
  "hiero-solo-action": { label: "Solo Action", color: "var(--r-action)", focus: true },
  "hiero-json-rpc-relay": { label: "Relay", color: "var(--r-relay)", focus: true },
  "hiero-sdk-go": { label: "Go SDK", color: "var(--r-other)" },
  "hiero-sdk-python": { label: "Python SDK", color: "var(--r-other)" },
  "hiero-sdk-rust": { label: "Rust SDK", color: "var(--r-other)" },
  "hiero-sdk-cpp": { label: "C++ SDK", color: "var(--r-other)" },
  "hiero-sdk-swift": { label: "Swift SDK", color: "var(--r-other)" },
  "hiero-improvement-proposals": { label: "HIPs", color: "var(--r-other)" },
  "sdk-collaboration-hub": { label: "SDK hub", color: "var(--r-other)" },
  "hiero-mirror-node": { label: "Mirror Node", color: "var(--r-other)" },
  "hiero-block-node": { label: "Block Node", color: "var(--r-other)" },
  "hiero-consensus-node": { label: "Consensus Node", color: "var(--r-other)" },
};

export function repoMeta(repo: string): RepoMeta {
  const known = KNOWN[repo];
  if (known) return { focus: false, ...known };
  return { label: repo, color: "var(--r-other)", focus: false };
}

const REPO_URL = /https:\/\/github\.com\/hiero-ledger\/([\w.-]+)/;

export function repoFromUrl(url: string): string | null {
  return url.match(REPO_URL)?.[1] ?? null;
}

/** Colour for a heading such as "JS SDK" or "JSON-RPC Relay"; longest matching label wins. */
export function colorForTitle(title: string): string | null {
  const t = title.toLowerCase();
  let best: { len: number; color: string } | null = null;
  for (const { label, color } of Object.values(KNOWN)) {
    const l = label.toLowerCase();
    if ((t === l || t.includes(l)) && (!best || l.length > best.len)) best = { len: l.length, color };
  }
  return best?.color ?? null;
}
