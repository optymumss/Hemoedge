# Site Settings CMS — Design Spec

## Problem

`/admin/site-settings` (`src/app/admin/site-settings/page.tsx`) is an unconditional `<ComingSoon>` stub described as "Logo, navigation, and footer for the marketing site." The marketing site's logo text, nav links, and footer are entirely hardcoded in `src/components/public-nav.tsx` and `src/components/public-footer.tsx`. This spec makes them editable by a `super_admin`.

## Scope

- **Logo:** text only (`site_name`) — matches today exactly. No image upload; this app has no image logo today, so adding one would be new scope, not a placeholder fix.
- **Nav links:** one shared, ordered list of `{label, href}` pairs drives **both** the header nav and the footer — matches today's identical-links behavior in both places. No separate footer-only link list.
- **Link URLs are free-form text**, not a picklist of known routes. The super_admin is trusted the same way every other admin form in this codebase already trusts its operator (e.g. `admin/pages` lets a super_admin type any slug). A typo produces a dead link, not a security or data-integrity problem.
- **"Sign in"** stays hardcoded in `PublicNav` — it's an auth action, not nav/footer content, and out of scope for this pass.
- Soft cap: at most 8 nav links (a UX guard against an obviously-overflowing nav bar on a small marketing site — not a requirement anyone asked for, just a sane bound).

Out of scope: image/logo upload, per-link icons, footer-specific extra links (legal/social), route validation, header search (shipped, PR #59), notifications bell (shipped, PR #60).

## Schema

```sql
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'HemoEdge',
  nav_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, site_name, nav_links) values (
  '00000000-0000-4000-8000-0000000000f1',
  'HemoEdge',
  '[{"label":"Blog","href":"/blog"},{"label":"Team","href":"/team"},{"label":"Contact","href":"/contact"}]'::jsonb
);
```

Exactly one row, seeded at migration time with a fixed, well-known id. The app always reads/writes that exact id — no singleton-enforcement trigger or constraint trickery, since this table only ever has one editor (`super_admin`) and one row by convention, matching the simplicity already established elsewhere in this codebase (e.g. `platform_org_summary()`'s plain-RLS approach over adding machinery nobody asked for).

`nav_links` is a JSONB array rather than a separate table with a foreign key and an order column — it's always read and written as one unit (the whole list, in order), which is exactly the case a small embedded array serves better than a relational table.

## RLS

```sql
alter table public.site_settings enable row level security;

create policy "site_settings: public read"
  on public.site_settings for select
  using (true);

create policy "site_settings: super admin full access"
  on public.site_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
```

Unlike `pages`/`blog_posts` (which gate public reads on `status = 'published'`), `site_settings` has no draft/published concept — it's live config, not content awaiting review, so the public-read policy is unconditional. The marketing site renders for anonymous visitors, so this must not require authentication.

## Data flow

`getSiteSettings(supabase)` — an exception-safe wrapper, falling back to **today's exact hardcoded values** (`{siteName: "HemoEdge", navLinks: [Blog, Team, Contact]}`) on any error. This is public-facing: a broken query must never render an empty or broken nav.

All 6 marketing pages that currently render `<PublicNav />` / `<PublicFooter />` — `src/app/page.tsx`, `src/app/team/page.tsx`, `src/app/contact/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/[slug]/page.tsx` — are already `async` server components that already call `createClient()`. Each gets one added line, `const siteSettings = await getSiteSettings(supabase);`, and passes it down: `<PublicNav siteSettings={siteSettings} />`, `<PublicFooter siteSettings={siteSettings} />`. This is a small, repeated edit across 6 files rather than introducing a new shared layout — restructuring routing to consolidate 6 independent pages into one layout is a bigger, unrelated change than this CMS feature needs, per this codebase's own "don't propose unrelated refactoring" convention.

`PublicNav`/`PublicFooter` become prop-driven for their content (site name, nav links) while keeping their existing client-side behavior (mobile menu toggle, active-path highlighting).

The admin form at `/admin/site-settings` also calls `getSiteSettings(supabase)` to pre-fill its fields, then calls `updateSiteSettings(siteName, navLinks)` directly (not via `<form action>`, since the link list needs client-side add/remove state before submission — the same "call a server action directly from a client handler" pattern `feature-form.tsx` already uses in this codebase).

## Components

### `src/lib/site-settings/clean-nav-links.ts` (pure, unit-tested)

```ts
export type NavLink = { label: string; href: string };

const MAX_NAV_LINKS = 8;

export function cleanNavLinks(raw: NavLink[]): NavLink[] {
  return raw
    .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
    .filter((l) => l.label.length > 0 && l.href.length > 0)
    .slice(0, MAX_NAV_LINKS);
}
```

### `src/lib/site-settings/get-site-settings.ts`

```ts
export type SiteSettingsData = { siteName: string; navLinks: NavLink[] };

const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: "HemoEdge",
  navLinks: [
    { label: "Blog", href: "/blog" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
};
```

`getSiteSettings(supabase)` selects `site_name, nav_links` for the fixed id, returns `DEFAULT_SITE_SETTINGS` on any error or missing row.

### `src/lib/site-settings/update-site-settings.ts` (`"use server"`)

`updateSiteSettings(siteName: string, navLinks: NavLink[]): Promise<{ error: string } | { success: true }>` — requires a non-empty (trimmed) `siteName`, runs the input through `cleanNavLinks`, updates the fixed row, and revalidates `/`, `/blog`, `/team`, `/contact`. Requires `super_admin` — enforced by RLS (a non-super-admin's update silently affects zero rows since the `with check` fails, and the action reports the resulting Supabase error to the caller rather than claiming success).

### `src/app/admin/site-settings/page.tsx`

Gated the same way `/admin/pages` is: non-`super_admin` sees `<ComingSoon title="Super Admin only" ... />`. Fetches `getSiteSettings(supabase)` and renders `<SiteSettingsForm initial={...} />`.

### `src/app/admin/site-settings/site-settings-form.tsx` (`"use client"`)

Client state: `siteName: string`, `links: NavLink[]` (seeded from `initial`), `pending`, `error`, `success`. Renders a text input for the site name, one row per link (label input, href input, remove button), an "Add link" button (disabled once at the 8-link cap), and a submit button that calls `updateSiteSettings(siteName, links)` directly and reports the result.

### `src/components/public-nav.tsx` / `src/components/public-footer.tsx`

Both gain a `siteSettings: SiteSettingsData` prop, replacing the hardcoded `LINKS` constant and `"HemoEdge"` text with `siteSettings.navLinks` and `siteSettings.siteName`. `PublicFooter`'s copyright line becomes `&copy; {new Date().getFullYear()} {siteSettings.siteName}` (year still computed at render, never stored).

## Error handling

- `getSiteSettings` failures fall back to the exact current hardcoded content — the marketing site never shows an empty or broken nav/footer.
- `updateSiteSettings` returns `{ error: string }` rather than throwing, so the form can display it inline (matches `feature-form.tsx`'s error-handling convention).
- A non-super-admin who somehow reaches `updateSiteSettings` (bypassing the page gate) has their update match zero rows under RLS's `USING` clause — Postgrest treats an RLS-filtered update as a normal zero-row success, not an error, so this is a silent no-op rather than a thrown error. The data is still safe (nothing changes), but the actual enforcement that prevents a non-super-admin from reaching this action at all is the page-level gate above, not a loud rejection at the database layer.

## Testing

- Unit tests (`src/lib/site-settings/clean-nav-links.test.ts`): trims whitespace; drops a row missing a label; drops a row missing an href; drops a row missing both; caps output at 8 even when given more; preserves order; returns `[]` for `[]`.
- Live Playwright verification: as `demo.superadmin@optymumss.com`, change the site name and edit/add/remove nav links via `/admin/site-settings`, then confirm the new values render on `/`, `/blog`, `/team`, `/contact`, and one `/[slug]` custom page (if one exists in the demo data; otherwise confirm via the four fixed routes). Confirm `demo.contentmanager@optymumss.com`, `demo.orgadmin@optymumss.com`, and `demo.learner@optymumss.com` each see `<ComingSoon>` at `/admin/site-settings` instead of the form. Confirm an anonymous (logged-out) visit to `/` still renders the current nav/footer correctly (proves the public-read RLS policy works pre-authentication). Restore the original site name and links afterward so the demo site isn't left in a modified state. Light theme, dark theme, and mobile viewport for the admin form.
