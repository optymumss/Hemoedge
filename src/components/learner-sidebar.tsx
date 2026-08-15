"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";

const ICON_PATHS: Record<string, React.ReactNode> = {
  Dashboard: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  Cases: (
    <path
      d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1 1.4h5.4A1.5 1.5 0 0 1 14 5.9v5.6A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Competency: (
    <path
      d="M8 2 3 3.6v3.9c0 3.2 2.1 5.9 5 6.5 2.9-.6 5-3.3 5-6.5V3.6L8 2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Certificates: (
    <>
      <circle cx="8" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 9.4 5 14l3-1.5L11 14l-.8-4.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  Modules: (
    <path
      d="M3 2.5h6.5A1.5 1.5 0 0 1 11 4v9.5H4.5A1.5 1.5 0 0 1 3 12V2.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Library: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6h11M6 6v7.5" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  "WBC Diff Counter": (
    <path
      d="M11.5 2.5 4.6 9.4a1 1 0 0 0 0 1.4l.6.6a1 1 0 0 0 1.4 0l6.9-6.9-2-2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
};

function NavIcon({ label }: { label: string }) {
  const path = ICON_PATHS[label];
  if (!path) return null;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      {path}
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 2c3 4 6 7.2 6 10.5a6 6 0 1 1-12 0C4 9.2 7 6 10 2Z"
          fill="var(--accent)"
        />
      </svg>
      <p className="text-sm font-semibold tracking-tight text-ink">HemoEdge</p>
    </div>
  );
}

export function LearnerSidebar({
  identity,
  role,
  sections,
  settingsHref,
  onLogout,
}: {
  identity: string;
  role?: string;
  sections: NavSection[];
  settingsHref: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const initial = identity.trim().charAt(0).toUpperCase() || "?";
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation — adjusted during render (React's
  // recommended pattern for resetting state on a prop change) rather than
  // in an effect.
  const [drawerPathname, setDrawerPathname] = useState(pathname);
  if (pathname !== drawerPathname) {
    setDrawerPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-4 py-3 md:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="learner-sidebar"
          className="rounded-md p-1.5 text-ink hover:bg-surface-raised"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="learner-sidebar"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 flex-col overflow-y-auto border-r border-line bg-surface-sunken px-4 py-5 md:static md:z-auto md:flex md:w-64 md:shrink-0`}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-ink hover:bg-surface-raised md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-5" aria-label="Primary">
          {sections.map((section, i) => (
            <div key={section.section || i}>
              {section.section && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {section.section}
                </p>
              )}
              <ul className={`flex flex-col gap-0.5 ${section.section ? "mt-1.5" : ""}`}>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-accent text-accent-ink font-medium"
                            : "text-ink hover:bg-surface-raised"
                        }`}
                      >
                        <NavIcon label={item.label} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-6 flex items-center gap-2.5 border-t border-line pt-4">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-ink"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{identity}</p>
            {role && <p className="truncate text-xs text-ink-dim">{role}</p>}
          </div>
          <Link
            href={settingsHref}
            aria-current={pathname === settingsHref ? "page" : undefined}
            aria-label="Settings"
            className={`rounded-md p-1.5 hover:bg-surface-raised ${
              pathname === settingsHref ? "text-accent" : "text-ink-faint hover:text-ink"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.4 3.6l-1 1M4.6 11.4l-1 1M12.4 12.4l-1-1M4.6 4.6l-1-1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </Link>
          <form action={onLogout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-md p-1.5 text-ink-faint hover:bg-surface-raised hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11.5 14 8m0 0-3.5-3.5M14 8H6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
