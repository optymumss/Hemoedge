"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar({
  title,
  identity,
  role,
  sections,
  settingsHref,
  onLogout,
}: {
  title: string;
  identity: string;
  role?: string;
  sections: NavSection[];
  settingsHref: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const initial = identity.trim().charAt(0).toUpperCase() || "?";
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation rather than leaving it open over
  // the new page — adjusted during render (React's recommended pattern for
  // resetting state on a prop change) rather than in an effect.
  const [drawerPathname, setDrawerPathname] = useState(pathname);
  if (pathname !== drawerPathname) {
    setDrawerPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-4 py-3 md:hidden">
        <p className="text-sm font-semibold tracking-tight text-ink">{title}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-sidebar"
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
        id="admin-sidebar"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 flex-col overflow-y-auto border-r border-line bg-surface-sunken px-4 py-5 md:static md:z-auto md:flex md:w-64 md:shrink-0`}
      >
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-semibold tracking-tight text-ink">{title}</p>
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
          {sections.map((section) => (
            <div key={section.section}>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {section.section}
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-accent text-accent-ink font-medium"
                            : "text-ink hover:bg-surface-raised"
                        }`}
                      >
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
