"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("theme", root.dataset.theme);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="whitespace-nowrap font-mono text-[0.68rem] uppercase tracking-[0.18em] hover:text-accent"
    >
      <span className="theme-label-light">Night<span className="hidden sm:inline"> edition</span></span>
      <span className="theme-label-dark">Day<span className="hidden sm:inline"> edition</span></span>
    </button>
  );
}

/** Runs before paint so the saved theme doesn't flash. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
