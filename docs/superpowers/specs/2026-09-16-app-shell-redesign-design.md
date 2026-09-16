# App-Wide Shell Redesign (Sidebar + Header) Design

## Context

The cofounder shared a premium reference mockup for the learner dashboard (dark maroon sidebar with icons and a tagline, a persistent header with greeting/search/notifications) and asked for the app to move much closer to it visually. That mockup also reverses two earlier explicit decisions (real trend-delta tracking instead of omitting deltas; embedding the live WSI viewer + Manual Diff Counter on the dashboard instead of a static preview) and adds one net-new visual element (a persistent top header) that doesn't exist in the app today.

The full redesign spans three independent subsystems:

- **A. App-wide shell redesign** (this spec) — the sidebar and a new header, applied across all three portals (learner, org, admin).
- **B. Historical trend tracking** (separate spec, not yet written) — new backend schema/logic so "vs last month" deltas and sparklines are real.
- **C. Learner dashboard v2** (separate spec, not yet written) — the actual dashboard page: hero card, stat tiles, Certificates panel, Recent Quiz Scores, Study Next, Quick Access, and the embedded live WSI viewer + diff counter.

This spec covers **A only**. B and C are out of scope here and will each get their own brainstorm/spec/plan cycle.

## Goals

- Replace the current split sidebar implementation (a generic `Sidebar` used by org/admin, a separate `LearnerSidebar` used by the learner portal) with a single shared component used by all three portals.
- Give the sidebar a permanently dark maroon appearance that does not change with the light/dark toggle, matching the reference exactly for the learner portal.
- Add icons to every nav item across all three portals (today only the learner sidebar has icons).
- Add a new persistent header component above the content area, present in all three portals: a time-based greeting, and placeholder (non-functional) search and notification affordances.
- Keep the rest of the app's design tokens and theming behavior (light/dark mode for content, accent color, etc.) exactly as they are today — only the sidebar becomes theme-invariant.

## Non-goals

- No dashboard page content changes (hero card, stat tiles, WSI panel, etc.) — that's sub-project C.
- No real search functionality — the header search input is a styled placeholder only.
- No real notifications system — the header bell is a styled placeholder only (static or no badge, no dropdown, no data model).
- No new icon library dependency — icons stay hand-rolled inline SVG, matching the existing convention.
- No visual changes to org/admin content *beyond* the shared shell — their dashboards, tables, and forms are untouched by this spec.
- Org and admin taglines/icons are best-effort placeholders since no reference exists for those portals yet; they are expected to be revisited once those references arrive.

## Current State (for reference)

- `src/components/sidebar.tsx` — generic `Sidebar`, used by `src/app/org/layout.tsx` (`title="Organization Portal"`) and `src/app/admin/layout.tsx` (`title="HemoEdge Admin"`). Plain text nav links, no icons, a plain `title` prop instead of a brand mark, background is `bg-surface-sunken` (theme-responsive).
- `src/components/learner-sidebar.tsx` — `LearnerSidebar`, used only by `src/app/app/layout.tsx`. Has a `BrandMark` (HemoEdge wordmark + a drop icon) and an `ICON_PATHS` map keyed by nav item label, rendered via a local `NavIcon` component. Also `bg-surface-sunken` (theme-responsive).
- No header/top-bar component exists anywhere in the app. Pages render their own `<h1>` with no shared chrome above it.
- `src/lib/nav.ts` defines `NavItem`, `NavSection`, `adminNav`, `orgNav`, `appNav` (learner), and `visibleFor(nav, role)`.
- `src/app/globals.css` defines the Field Clarity token system (`--ink`, `--surface`, `--accent`, etc.) with light-mode defaults, a `prefers-color-scheme: dark` block, and explicit `[data-theme="dark"]`/`[data-theme="light"]` overrides — all consumed via Tailwind utilities (`bg-surface`, `text-ink-dim`, etc.).

## Architecture

### 1. Unified `Sidebar` component

`src/components/sidebar.tsx` is rewritten to absorb everything `LearnerSidebar` does today, plus the new dark styling and a tagline slot. `src/components/learner-sidebar.tsx` is deleted.

New props:

```ts
export function Sidebar({
  tagline,       // e.g. "BLOOD FILM LEARNING" — replaces the old `title` prop
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
})
```

The `title` prop org/admin currently pass (`"Organization Portal"`, `"HemoEdge Admin"`) is replaced by `tagline`, rendered under the `BrandMark` exactly like the reference's "BLOOD FILM LEARNING" line — since `BrandMark` already renders the "HemoEdge" wordmark, the tagline no longer needs to repeat it. Call sites:

- Learner (`src/app/app/layout.tsx`): `tagline="BLOOD FILM LEARNING"`
- Org (`src/app/org/layout.tsx`): `tagline="ORGANIZATION"` (placeholder, no reference yet)
- Admin (`src/app/admin/layout.tsx`): `tagline="PLATFORM ADMIN"` (placeholder, no reference yet)

`BrandMark` moves from `learner-sidebar.tsx` into `sidebar.tsx` unchanged (it's already generic — just a drop icon + "HemoEdge" text).

### 2. Icons: shared `nav-icons.tsx`

The existing `ICON_PATHS` map and `NavIcon` component move from `learner-sidebar.tsx` into a new `src/components/nav-icons.tsx`, unchanged in style (16x16 viewBox, `stroke="currentColor"`, `strokeWidth="1.4"`).

Additions needed:

- **"Cell Identification"** — missing today even for the learner nav that already uses icons. New icon: a simple magnifying-glass-over-cell glyph, consistent stroke style.
- **Generic fallback icon** — for any org/admin nav label with no specific entry in `ICON_PATHS` (which today is all of them except reusable labels like "Modules", "Learning Pathways", "Manual Diff Counter", "Cell Identification" that already exist from the learner nav and are label-matched, not portal-matched, so they're reused automatically). The fallback is a single filled circle (`<circle cx="8" cy="8" r="3" fill="currentColor" />`, same 16x16 viewBox as every other icon), so no admin/org nav item is left with a blank icon slot.

`NavIcon` therefore becomes: look up `ICON_PATHS[label]`; if missing, render the fallback dot glyph instead of `null`.

### 3. Dark sidebar tokens

New tokens added to `src/app/globals.css`, defined once on `:root` and **not** overridden in the `prefers-color-scheme: dark` block or the `[data-theme]` blocks — the whole point is that these stay constant regardless of theme:

```css
:root {
  /* ...existing tokens... */
  --sidebar-bg: #3a0f1a;        /* dark maroon, distinct from --accent-soft/--danger */
  --sidebar-bg-raised: #4a1522; /* slightly lighter, for the mobile drawer's top bar */
  --sidebar-ink: #f5e9ec;       /* near-white, for primary sidebar text */
  --sidebar-ink-dim: #c9a3ad;   /* muted rose, for taglines/secondary text */
  --sidebar-border: #582030;    /* dividers within the sidebar */
  --sidebar-active-bg: var(--accent-ink); /* reuse existing token: white-on-accent for the active nav pill background is already `bg-accent text-accent-ink` and stays as-is since --accent already reads correctly on the dark sidebar */
}

@theme inline {
  /* ...existing entries... */
  --color-sidebar-bg: var(--sidebar-bg);
  --color-sidebar-bg-raised: var(--sidebar-bg-raised);
  --color-sidebar-ink: var(--sidebar-ink);
  --color-sidebar-ink-dim: var(--sidebar-ink-dim);
  --color-sidebar-border: var(--sidebar-border);
}
```

`Sidebar` swaps its Tailwind classes from the theme-responsive `bg-surface-sunken`/`text-ink`/`border-line` to the new `bg-sidebar-bg`/`text-sidebar-ink`/`border-sidebar-border` (and `bg-sidebar-bg-raised` for the mobile top bar). The active nav item keeps `bg-accent text-accent-ink` (already theme-invariant enough — the accent token already provides sufficient contrast against the dark sidebar in both modes since it's a single fixed maroon/rose value per mode, and the sidebar no longer changes with the mode so `--accent`'s light-mode value, the wine/crimson `#9e2a46`, is what always shows against `--sidebar-bg` `#3a0f1a` — verified for contrast during implementation).

The `ThemeToggle` is removed from the sidebar (it doesn't make sense inside a component that no longer changes with the toggle) and moves into the new `Header`.

### 4. New `Header` component

`src/components/header.tsx` (new), a server-renderable component (no client interactivity of its own beyond `ThemeToggle`, which is already its own client component):

```ts
export function Header({
  identity,       // first name for the greeting, e.g. "Subra"
}: {
  identity: string;
})
```

Renders:
- Left: a time-based greeting — `"Good {morning|afternoon|evening}, {identity}"` — via a new pure function `getGreeting(date: Date, name: string): string` in `src/lib/greeting.ts`, unit-tested for the three time bands (before 12: morning, 12–17: afternoon, after 17: evening) using boundary and mid-band cases.
- Right: a placeholder search input (`<input placeholder="Search modules, cases, or topics..." disabled />` styled to look active, with a decorative `⌘K` hint — no `onChange`/`onSubmit`, purely visual), a placeholder notification bell (an SVG bell icon button with no badge and no click handler wired to real data — `aria-label="Notifications"`, visually present, functionally inert), and `ThemeToggle`.

Rendered identically in all three layouts, directly above `{children}` (inside `<main>`'s parent, not inside `<main>` itself, so it reads as chrome rather than page content):

```tsx
<main id="main-content" className="flex-1 overflow-y-auto">
  <Header identity={firstName(identity)} />
  <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
</main>
```

(The existing `px-4 py-6 sm:px-8 sm:py-8` padding moves from `<main>` onto this new inner wrapper so the header can span full-bleed above it with its own border/background.)

A small `firstName(identity: string): string` helper (split on whitespace, take the first token) extracts "Subra" from a full name or email for the greeting — falls back to the full `identity` string if it has no whitespace (e.g. bare email with no display name).

## File Changes

- **Modify** `src/components/sidebar.tsx` — full rewrite per Architecture §1 and §3.
- **Delete** `src/components/learner-sidebar.tsx` — superseded by the unified `Sidebar`.
- **Create** `src/components/nav-icons.tsx` — `ICON_PATHS`, `NavIcon`, fallback glyph, new "Cell Identification" icon.
- **Create** `src/components/header.tsx` — per Architecture §4.
- **Create** `src/lib/greeting.ts` — `getGreeting`, `firstName`.
- **Create** `src/lib/greeting.test.ts` — unit tests for `getGreeting` (morning/afternoon/evening boundaries) and `firstName` (full name, single name, bare email).
- **Modify** `src/app/globals.css` — add the five `--sidebar-*` tokens and their `@theme inline` mappings per Architecture §3.
- **Modify** `src/app/app/layout.tsx` — swap `LearnerSidebar` for `Sidebar` (with `tagline="BLOOD FILM LEARNING"`), add `Header`, move padding as shown above.
- **Modify** `src/app/org/layout.tsx` — swap `title` prop for `tagline="ORGANIZATION"`, add `Header`, move padding.
- **Modify** `src/app/admin/layout.tsx` — same as org, `tagline="PLATFORM ADMIN"`.

No database schema changes. No new dependencies.

## Testing

- **Unit tests** (Vitest, following this codebase's established pure-logic-gets-unit-tests convention): `getGreeting` and `firstName` in `src/lib/greeting.test.ts`.
- **Manual/Playwright verification** (no automated test framework for components in this repo): after implementation, visually verify via Playwright screenshots, logged in as the demo learner and as an org/admin test account:
  - Learner, org, and admin dashboards all show the new dark sidebar with icons and the correct tagline.
  - The header renders with the correct time-based greeting, and the search/notification placeholders are visually present but inert (typing in search does nothing, clicking the bell does nothing).
  - Sidebar stays dark in both light and dark mode (toggle the theme and confirm the sidebar is unchanged while the content area's colors do change).
  - Mobile drawer (narrow viewport) still opens/closes correctly with the new dark styling.
  - No other page content (existing dashboard cards, tables, forms) regressed.

## Open Items / Follow-ups (not in this spec)

- Sub-project B (historical trend tracking) and C (learner dashboard v2 content) are separate specs.
- Org and admin sidebar taglines and any icons using the generic fallback glyph are placeholders pending those portals' own reference mockups.
- Real search and real notifications are explicitly deferred; if/when built, they become their own sub-projects.
