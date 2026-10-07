"use client";

export function ThemeToggle({
  light = "Night",
  dark = "Day",
  suffix = " edition",
  className = "whitespace-nowrap font-mono text-[0.68rem] uppercase tracking-[0.18em] hover:text-accent",
}: {
  light?: string;
  dark?: string;
  suffix?: string;
  className?: string;
}) {
  function toggle() {
    const root = document.documentElement;
    const isDark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = isDark ? "light" : "dark";
    try {
      localStorage.setItem("theme", root.dataset.theme);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
    >
      <span className="theme-label-light">
        {light}
        {suffix && <span className="hidden sm:inline">{suffix}</span>}
      </span>
      <span className="theme-label-dark">
        {dark}
        {suffix && <span className="hidden sm:inline">{suffix}</span>}
      </span>
    </button>
  );
}

/** Runs before paint so the saved theme doesn't flash. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
