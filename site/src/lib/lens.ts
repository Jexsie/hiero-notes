/**
 * Marks every [data-repos] element under `target` that links to `repo` with data-hit and
 * sets data-lens on the target, so CSS can dim the rest. Returns the number of matches,
 * not counting matches nested inside another match.
 */
export function applyLens(target: string, repo: string | null): number {
  const root = document.getElementById(target);
  if (!root) return 0;
  root.toggleAttribute("data-lens", repo !== null);
  let n = 0;
  for (const el of root.querySelectorAll<HTMLElement>("[data-repos]")) {
    const match = repo !== null && el.dataset.repos!.split(" ").includes(repo);
    el.toggleAttribute("data-hit", match);
    if (match && !el.parentElement?.closest("[data-hit]")) n++;
  }
  return n;
}
