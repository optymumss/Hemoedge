"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          HemoEdge
        </Link>
        <div className="flex items-center gap-6 text-sm text-ink-dim">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hidden hover:text-ink sm:inline">
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-md bg-accent px-3 py-1.5 text-accent-ink hover:opacity-90 sm:inline"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="public-nav-mobile-menu"
            className="rounded-md p-1.5 text-ink hover:bg-surface-raised sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {open ? (
                <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div id="public-nav-mobile-menu" className="border-t border-line px-6 py-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className="rounded-md px-2 py-2 text-sm text-ink-dim hover:bg-surface-raised hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-md bg-accent px-3 py-2 text-center text-sm text-accent-ink hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
