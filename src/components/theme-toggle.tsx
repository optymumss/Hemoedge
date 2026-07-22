"use client";

const THEME_STORAGE_KEY = "he-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const explicit = root.getAttribute("data-theme");
    const currentlyDark =
      explicit === "dark" ||
      (!explicit && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = currentlyDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className={`theme-toggle inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-dim hover:bg-surface-sunken hover:text-ink ${className}`}
    >
      <svg className="theme-toggle-sun" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M14 9.3A6 6 0 1 1 6.7 2a4.7 4.7 0 0 0 7.3 7.3Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="theme-toggle-moon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.83 3.17l-1.06 1.06M4.23 11.77l-1.06 1.06M12.83 12.83l-1.06-1.06M4.23 4.23L3.17 3.17"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
