# App-Wide Shell Redesign (Sidebar + Header) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's two divergent sidebar implementations with one shared, permanently-dark-maroon sidebar with icons, and add a new persistent header (greeting, placeholder search/notifications) — both applied across all three portals (learner, org, admin).

**Architecture:** A single `Sidebar` component (replacing `Sidebar` + `LearnerSidebar`) consumes a shared `nav-icons.tsx` icon lookup and new theme-invariant CSS tokens. A new `Header` component consumes a pure `getGreeting`/`firstName` helper. Both are wired into all three portal layouts, which also gain a small structural change (padding moves from `<main>` onto an inner wrapper so `Header` can span full-bleed above it).

**Tech Stack:** Next.js App Router (server components for layouts/Header), React client components for interactive pieces (`Sidebar`, `ThemeToggle`), Tailwind CSS v4 token system, Vitest for pure-logic unit tests.

## Global Constraints

- No new dependencies (icons stay hand-rolled inline SVG, matching the existing convention).
- No new database tables/columns.
- The sidebar's background/text tokens (`--sidebar-*`) must NOT be overridden by `prefers-color-scheme: dark` or `[data-theme]` blocks — they stay constant in both light and dark mode. Every other existing token's light/dark behavior is unchanged.
- The header's search input and notification bell are visual only — no real search query, no real notifications data, no `onChange`/`onClick` handlers that do anything. Do not wire them to any backend.
- Org and admin taglines (`"ORGANIZATION"`, `"PLATFORM ADMIN"`) and the icon fallback glyph for any org/admin nav item without a specific icon are explicit placeholders pending those portals' own reference mockups — do not invent bespoke icons for every admin/org nav item.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm run test` after every task; all three must be clean before moving to the next task. Because `Sidebar`'s prop shape changes (dropping `title`, adding `tagline`), the task that changes `Sidebar` must update all three layout call sites in the same task — the repo must compile after every task, not just at the end of the plan.

---

### Task 1: Time-based greeting — pure logic

**Files:**
- Create: `src/lib/greeting.ts`
- Test: `src/lib/greeting.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `export function getGreeting(date: Date, name: string): string` — e.g. `getGreeting(new Date(2026, 0, 1, 14, 0), "Subra")` returns `"Good afternoon, Subra"`. Boundaries: hour < 12 is morning, 12 ≤ hour < 17 is afternoon, hour ≥ 17 is evening.
  - `export function firstName(identity: string): string` — takes the first whitespace-separated token of a trimmed string; returns the whole trimmed string unchanged if there's no whitespace (e.g. a bare email). Used by Task 4's `Header`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/greeting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getGreeting, firstName } from "./greeting";

describe("getGreeting", () => {
  it("says good morning before noon", () => {
    expect(getGreeting(new Date(2026, 0, 1, 0, 0), "Subra")).toBe("Good morning, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 11, 59), "Subra")).toBe("Good morning, Subra");
  });

  it("says good afternoon from noon up to 5pm", () => {
    expect(getGreeting(new Date(2026, 0, 1, 12, 0), "Subra")).toBe("Good afternoon, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 16, 59), "Subra")).toBe("Good afternoon, Subra");
  });

  it("says good evening from 5pm onward", () => {
    expect(getGreeting(new Date(2026, 0, 1, 17, 0), "Subra")).toBe("Good evening, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 23, 59), "Subra")).toBe("Good evening, Subra");
  });
});

describe("firstName", () => {
  it("takes the first word of a full name", () => {
    expect(firstName("Subra B")).toBe("Subra");
  });

  it("returns the whole string when there's no space", () => {
    expect(firstName("Subra")).toBe("Subra");
  });

  it("returns a bare email unchanged", () => {
    expect(firstName("demo.learner@optymumss.com")).toBe("demo.learner@optymumss.com");
  });

  it("trims surrounding whitespace before splitting", () => {
    expect(firstName("  Subra B  ")).toBe("Subra");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/greeting.test.ts`
Expected: FAIL — `Cannot find module './greeting'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/greeting.ts`:

```ts
/**
 * Time-based greeting shown in the app header, e.g. "Good afternoon, Subra".
 * Boundaries: before 12:00 is morning, 12:00-16:59 is afternoon, 17:00+ is evening.
 */
export function getGreeting(date: Date, name: string): string {
  const hour = date.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${timeOfDay}, ${name}`;
}

/**
 * Extracts a first name from a full name for the greeting. Falls back to
 * the whole (trimmed) string when there's no whitespace to split on, so a
 * bare email still renders sensibly.
 */
export function firstName(identity: string): string {
  const trimmed = identity.trim();
  const spaceIndex = trimmed.indexOf(" ");
  return spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/greeting.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/greeting.ts src/lib/greeting.test.ts
git commit -m "Add time-based greeting helper for the app header"
```

---

### Task 2: Shared nav icon set

**Files:**
- Create: `src/components/nav-icons.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure presentational, no props beyond `label`).
- Produces:
  - `export function NavIcon({ label }: { label: string }): JSX.Element` — renders the icon matching `label` from a fixed lookup table, or a generic fallback glyph if there's no specific match. Always renders something (never `null`) — consumed by Task 3's `Sidebar`.

This is the existing `ICON_PATHS`/`NavIcon` pair from `src/components/learner-sidebar.tsx`, relocated so both the learner and org/admin portals can use it, plus one new icon ("Cell Identification", present in both the learner and admin nav but never iconified) and a fallback glyph for org/admin items that don't have a specific icon.

- [ ] **Step 1: Create the icon module**

Create `src/components/nav-icons.tsx`:

```tsx
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
  "Learning Pathways": (
    <path
      d="M8 2 3 3.6v3.9c0 3.2 2.1 5.9 5 6.5 2.9-.6 5-3.3 5-6.5V3.6L8 2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Competencies: (
    <>
      <path
        d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.8L13 4.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 8.2 7 9.7l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
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
  "Manual Diff Counter": (
    <path
      d="M11.5 2.5 4.6 9.4a1 1 0 0 0 0 1.4l.6.6a1 1 0 0 0 1.4 0l6.9-6.9-2-2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  "Cell Identification": (
    <>
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="m11.5 11.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6.5" cy="6.5" r="1.4" fill="currentColor" />
    </>
  ),
};

/** Rendered for any nav label with no entry in ICON_PATHS above — currently
 * every org/admin item other than the labels they share with the learner
 * nav (Modules, Learning Pathways, Manual Diff Counter, Cell Identification).
 * A placeholder until those portals get their own reference mockups. */
const FALLBACK_ICON: React.ReactNode = <circle cx="8" cy="8" r="3" fill="currentColor" />;

export function NavIcon({ label }: { label: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      {ICON_PATHS[label] ?? FALLBACK_ICON}
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean (this file has no consumer yet, so nothing else changes behavior)

- [ ] **Step 3: Commit**

```bash
git add src/components/nav-icons.tsx
git commit -m "Add shared nav icon set for the app-wide sidebar"
```

---

### Task 3: Unified dark sidebar

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/sidebar.tsx` (full rewrite)
- Delete: `src/components/learner-sidebar.tsx`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/app/org/layout.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `NavIcon` from `@/components/nav-icons` (Task 2).
- Produces: `export function Sidebar(props: { tagline: string; identity: string; role?: string; sections: NavSection[]; settingsHref: string; onLogout: () => void }): JSX.Element` — replaces both the old `Sidebar` (which took `title` instead of `tagline`) and `LearnerSidebar`. Consumed by Task 4 (no changes needed there beyond what this task already does) and used as-is by all three layouts.

This task is atomic: `Sidebar`'s prop shape changes (`title` → `tagline`), so every call site must be updated in this same task or the build won't compile.

- [ ] **Step 1: Add the dark sidebar tokens**

In `src/app/globals.css`, add five new tokens to the `:root` block (after the existing `--info-soft-ink: #184e8a;` line, still inside the same `:root { ... }`):

```css
  --sidebar-bg: #3a0f1a;
  --sidebar-bg-raised: #4a1522;
  --sidebar-ink: #f5e9ec;
  --sidebar-ink-dim: #c9a3ad;
  --sidebar-border: #582030;
```

Do **not** add these to the `@media (prefers-color-scheme: dark)` block, the `[data-theme="dark"]` block, or the `[data-theme="light"]` block — they must stay constant across all three regardless of theme.

Then add the matching Tailwind mappings to the `@theme inline` block (after the existing `--color-info-soft-ink: var(--info-soft-ink);` line):

```css
  --color-sidebar-bg: var(--sidebar-bg);
  --color-sidebar-bg-raised: var(--sidebar-bg-raised);
  --color-sidebar-ink: var(--sidebar-ink);
  --color-sidebar-ink-dim: var(--sidebar-ink-dim);
  --color-sidebar-border: var(--sidebar-border);
```

- [ ] **Step 2: Rewrite the Sidebar component**

Replace the entire contents of `src/components/sidebar.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { NavIcon } from "@/components/nav-icons";

function BrandMark({ tagline }: { tagline: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2c3 4 6 7.2 6 10.5a6 6 0 1 1-12 0C4 9.2 7 6 10 2Z" fill="var(--accent)" />
      </svg>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-sidebar-ink">HemoEdge</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-ink-dim">{tagline}</p>
      </div>
    </div>
  );
}

export function Sidebar({
  tagline,
  identity,
  role,
  sections,
  settingsHref,
  onLogout,
}: {
  tagline: string;
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
      <div className="flex items-center justify-between border-b border-sidebar-border bg-sidebar-bg-raised px-4 py-3 md:hidden">
        <BrandMark tagline={tagline} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="rounded-md p-1.5 text-sidebar-ink hover:bg-sidebar-bg-raised"
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
        id="app-sidebar"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-bg px-4 py-5 md:static md:z-auto md:flex md:w-64 md:shrink-0`}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark tagline={tagline} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-sidebar-ink hover:bg-sidebar-bg-raised md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-5" aria-label="Primary">
          {sections.map((section, i) => (
            <div key={section.section || i}>
              {section.section && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink-dim">
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
                            : "text-sidebar-ink hover:bg-sidebar-bg-raised"
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

        <div className="mt-6 flex items-center gap-2.5 border-t border-sidebar-border pt-4">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-ink"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-ink">{identity}</p>
            {role && <p className="truncate text-xs text-sidebar-ink-dim">{role}</p>}
          </div>
          <Link
            href={settingsHref}
            aria-current={pathname === settingsHref ? "page" : undefined}
            aria-label="Settings"
            className={`rounded-md p-1.5 hover:bg-sidebar-bg-raised ${
              pathname === settingsHref ? "text-accent" : "text-sidebar-ink-dim hover:text-sidebar-ink"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.4" />
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
              className="rounded-md p-1.5 text-sidebar-ink-dim hover:bg-sidebar-bg-raised hover:text-sidebar-ink"
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
```

Note the `ThemeToggle` that used to live in the sidebar's header row is gone — it moves into the new `Header` component in Task 4, since a toggle that changes the theme no longer makes sense sitting inside a component that never changes with the theme.

- [ ] **Step 3: Delete the old learner sidebar**

```bash
git rm src/components/learner-sidebar.tsx
```

- [ ] **Step 4: Update the learner layout**

In `src/app/app/layout.tsx`, replace the `LearnerSidebar` import and usage with `Sidebar`:

```tsx
import { Sidebar } from "@/components/sidebar";
```

(replaces `import { LearnerSidebar } from "@/components/learner-sidebar";`)

```tsx
        <Sidebar
          tagline="BLOOD FILM LEARNING"
          identity={identity}
          role={ROLE_LABELS[effectiveRole]}
          sections={sections}
          settingsHref="/app/settings"
          onLogout={logout}
        />
```

(replaces the `<LearnerSidebar ... />` block, same prop values except `tagline` instead of no title prop)

- [ ] **Step 5: Update the org layout**

In `src/app/org/layout.tsx`, change:

```tsx
        <Sidebar
          title="Organization Portal"
```

to:

```tsx
        <Sidebar
          tagline="ORGANIZATION"
```

(everything else in that `<Sidebar>` call is unchanged)

- [ ] **Step 6: Update the admin layout**

In `src/app/admin/layout.tsx`, change:

```tsx
        <Sidebar
          title="HemoEdge Admin"
```

to:

```tsx
        <Sidebar
          tagline="PLATFORM ADMIN"
```

(everything else in that `<Sidebar>` call is unchanged)

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean — `tsc` in particular must show no error about a missing `title` prop or a missing `learner-sidebar` module.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Unify the sidebar into one dark, icon-driven component across all three portals"
```

---

### Task 4: Header component and wiring

**Files:**
- Create: `src/components/header.tsx`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/app/org/layout.tsx`
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `getGreeting`, `firstName` from `@/lib/greeting` (Task 1); `ThemeToggle` from `@/components/theme-toggle` (pre-existing, unchanged).
- Produces: `export function Header({ identity }: { identity: string }): JSX.Element` — rendered once per layout, above `{children}`.

- [ ] **Step 1: Create the Header component**

Create `src/components/header.tsx`:

```tsx
import { getGreeting, firstName } from "@/lib/greeting";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header({ identity }: { identity: string }) {
  const greeting = getGreeting(new Date(), firstName(identity));

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-8">
      <div>
        <p className="text-lg font-semibold text-ink">{greeting}</p>
        <p className="text-sm text-ink-dim">You&apos;re doing great — keep up the momentum.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <input
            type="text"
            placeholder="Search modules, cases, or topics..."
            aria-label="Search"
            className="w-64 rounded-md border border-line-strong bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-faint">
            ⌘K
          </span>
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-md p-2 text-ink-dim hover:bg-surface-sunken"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M9 2.5c-2.2 0-4 1.8-4 4v2.3c0 .5-.2 1-.5 1.4L3.4 11.5A1 1 0 0 0 4.2 13h9.6a1 1 0 0 0 .8-1.5l-1.1-1.3a2 2 0 0 1-.5-1.4V6.5c0-2.2-1.8-4-4-4Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M7.5 15a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
```

The search input and notification button have no `onChange`/`onClick` — they're visually complete but functionally inert, per this plan's Global Constraints.

- [ ] **Step 2: Wire the header into the learner layout**

In `src/app/app/layout.tsx`, add the import:

```tsx
import { Header } from "@/components/header";
```

Replace the `<main>` block:

```tsx
        <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
```

with:

```tsx
        <main id="main-content" className="flex flex-1 flex-col overflow-y-auto">
          <Header identity={identity} />
          <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
```

- [ ] **Step 3: Wire the header into the org layout**

In `src/app/org/layout.tsx`, add the same `Header` import and apply the identical `<main>` replacement shown in Step 2 (this layout already has an `identity` variable in scope).

- [ ] **Step 4: Wire the header into the admin layout**

In `src/app/admin/layout.tsx`, add the same `Header` import and apply the identical `<main>` replacement shown in Step 2 (this layout already has an `identity` variable in scope).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git add src/components/header.tsx src/app/app/layout.tsx src/app/org/layout.tsx src/app/admin/layout.tsx
git commit -m "Add app-wide header with greeting and placeholder search/notifications"
```

---

### Task 5: Live verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Start the dev server**

Use the existing `.env.local` (Supabase URL + publishable key already configured in this environment). Run `npm run dev`.

- [ ] **Step 2: Verify the learner portal**

Log in as `demo.learner@optymumss.com` and load `/app`. Confirm:
- The sidebar is dark maroon with the HemoEdge wordmark, the "BLOOD FILM LEARNING" tagline beneath it, and an icon next to every nav item (including "Cell Identification", which had no icon before this plan).
- The header renders above the page content with a time-appropriate greeting containing the learner's first name, and the search box / notification bell are visually present.
- Typing in the search box does nothing beyond showing the typed text locally; clicking the notification bell does nothing.
- Toggling light/dark mode changes the header and page content colors but leaves the sidebar's dark maroon unchanged.
- The mobile drawer (narrow viewport) still opens and closes correctly with the new dark styling.

- [ ] **Step 3: Verify the org and admin portals**

Log in as an org and an admin test account (or impersonate, if that's the available path in this environment) and load `/org` and `/admin`. Confirm:
- Both show the same dark sidebar treatment with their respective taglines ("ORGANIZATION", "PLATFORM ADMIN") and the same header (greeting personalized to that account, search/notification placeholders).
- Nav items that share a label with the learner nav (e.g. "Modules", "Manual Diff Counter") show the same specific icon; every other nav item shows the fallback dot glyph rather than a blank space.

- [ ] **Step 4: Confirm no regressions**

Spot-check a few pages inside each portal (e.g. `/app/cases`, `/org/roster`, `/admin/modules`) to confirm their own content renders unchanged — this plan only touches the shared shell (sidebar + header), not page content.

- [ ] **Step 5: Stop the dev server**

```bash
pkill -f "next dev"
```

---

## Explicitly out of scope for this plan

- Sub-project B (real historical trend tracking for stat-tile deltas) and sub-project C (learner dashboard v2 content — hero card, stat tiles, Certificates panel, embedded live WSI viewer + diff counter) are separate plans, per `docs/superpowers/specs/2026-09-16-app-shell-redesign-design.md`.
- Real search functionality and a real notifications system — both explicitly deferred to their own future sub-projects if/when built.
- Bespoke icons or a finished visual treatment for every individual org/admin nav item — those wait on their own reference mockups.
