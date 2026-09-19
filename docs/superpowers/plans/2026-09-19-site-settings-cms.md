# Site Settings CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/admin/site-settings` `<ComingSoon>` stub with a real editor for the marketing site's logo text and shared nav/footer link list, and make `PublicNav`/`PublicFooter` read from it instead of hardcoded values.

**Architecture:** A single-row `site_settings` table (public read, `super_admin`-only write) holds `site_name` and a `nav_links` JSONB array. An exception-safe wrapper feeds all 6 marketing pages, each of which passes the result into `PublicNav`/`PublicFooter` as props instead of those components hardcoding their content. A client form on `/admin/site-settings` edits both fields and calls a server action directly (not via `<form action>`, since the link list needs client-side add/remove state before submission).

**Tech Stack:** Next.js App Router (server + client components), Supabase Postgres (RLS), Vitest, Playwright (`/opt/pw-browsers/chromium`) for live verification.

## Global Constraints

- Logo stays **text only** (`site_name`) — no image upload.
- **One shared** `nav_links` list drives both the header nav and the footer.
- Link hrefs are **free-form text** — no picklist, no route validation.
- "Sign in" stays hardcoded in `PublicNav` — out of scope.
- Soft cap: at most 8 nav links.
- `site_settings` is a singleton: exactly one row, seeded at migration time with the fixed id `00000000-0000-4000-8000-0000000000f1`, always read/written by that id — no enforcement trigger.
- RLS: public (including anonymous) `select`; `super_admin`-only write.
- `getSiteSettings` must fall back to today's exact hardcoded values (`{siteName: "HemoEdge", navLinks: [Blog, Team, Contact]}`) on any error — the marketing site must never render broken.
- This does not touch header search (shipped, PR #59) or the notifications bell (shipped, PR #60).

---

### Task 1: `site_settings` table, seed row, and RLS

**Files:**
- Create: `supabase/migrations/20260919120000_site_settings.sql`
- Modify: `src/lib/supabase/database.types.ts` (splice in the new `site_settings` table)

**Interfaces:**
- Consumes: nothing (schema-only task).
- Produces: the `public.site_settings` table (columns: `id, site_name, nav_links, updated_at`), reflected in `Database["public"]["Tables"]["site_settings"]`. Task 2 defines `NavLink` independently (pure, no DB dependency). Task 3 selects `site_name, nav_links` by the fixed id `00000000-0000-4000-8000-0000000000f1` and updates the same columns.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260919120000_site_settings.sql`:

```sql
-- Site Settings CMS: a singleton row (fixed id, seeded below) holding the
-- marketing site's logo text and one shared nav/footer link list. No
-- singleton-enforcement trigger -- this table only ever has one editor
-- (super_admin) and one row by convention, the same "don't build
-- machinery nobody asked for" simplicity already used for
-- platform_org_summary().
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

alter table public.site_settings enable row level security;

-- Unlike pages/blog_posts (public read gated on status = 'published'),
-- site_settings has no draft/published concept -- it's live config, and
-- the marketing site renders for anonymous visitors, so this is
-- unconditional.
create policy "site_settings: public read"
  on public.site_settings for select
  using (true);

create policy "site_settings: super admin full access"
  on public.site_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
```

- [ ] **Step 2: Apply the migration**

Run `mcp__Supabase__apply_migration` against the project (`uktdipvvnbgzasqlpudl`) with the file's contents, using `20260919120000_site_settings` as the migration name.

- [ ] **Step 3: Regenerate and splice in types**

Run `mcp__Supabase__generate_typescript_types`. It will exceed the tool's inline limit and save to a file — extract the `site_settings` entry from the `Tables` block and splice it into `src/lib/supabase/database.types.ts`'s existing `Tables` object, in alphabetical position (between `slides` and `tags`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919120000_site_settings.sql src/lib/supabase/database.types.ts
git commit -m "Add site_settings table (singleton), RLS, and seed row"
```

---

### Task 2: Pure nav-link cleaning logic

**Files:**
- Create: `src/lib/site-settings/clean-nav-links.ts`
- Test: `src/lib/site-settings/clean-nav-links.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other tasks).
- Produces:
  - `type NavLink = { label: string; href: string }`
  - `cleanNavLinks(raw: NavLink[]): NavLink[]`
  - Task 3 imports `NavLink` and `cleanNavLinks`. Task 4's form imports `NavLink`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/site-settings/clean-nav-links.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cleanNavLinks, type NavLink } from "./clean-nav-links";

describe("cleanNavLinks", () => {
  it("trims whitespace from label and href", () => {
    expect(cleanNavLinks([{ label: "  Blog  ", href: "  /blog  " }])).toEqual([
      { label: "Blog", href: "/blog" },
    ]);
  });

  it("drops a row missing a label", () => {
    expect(cleanNavLinks([{ label: "", href: "/blog" }])).toEqual([]);
  });

  it("drops a row missing an href", () => {
    expect(cleanNavLinks([{ label: "Blog", href: "" }])).toEqual([]);
  });

  it("drops a row missing both", () => {
    expect(cleanNavLinks([{ label: "", href: "" }])).toEqual([]);
  });

  it("caps output at 8 links even when given more", () => {
    const raw: NavLink[] = Array.from({ length: 10 }, (_, i) => ({
      label: `Link ${i}`,
      href: `/l${i}`,
    }));
    const result = cleanNavLinks(raw);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ label: "Link 0", href: "/l0" });
    expect(result[7]).toEqual({ label: "Link 7", href: "/l7" });
  });

  it("preserves order", () => {
    const raw: NavLink[] = [
      { label: "B", href: "/b" },
      { label: "A", href: "/a" },
    ];
    expect(cleanNavLinks(raw)).toEqual([
      { label: "B", href: "/b" },
      { label: "A", href: "/a" },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(cleanNavLinks([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/site-settings/clean-nav-links.test.ts`
Expected: FAIL — `Cannot find module './clean-nav-links'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/site-settings/clean-nav-links.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/site-settings/clean-nav-links.test.ts`
Expected: PASS — 7/7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site-settings/clean-nav-links.ts src/lib/site-settings/clean-nav-links.test.ts
git commit -m "Add pure nav-link cleaning logic (trim, drop empty, cap at 8)"
```

---

### Task 3: Data wrapper and update action

**Files:**
- Create: `src/lib/site-settings/get-site-settings.ts`
- Create: `src/lib/site-settings/update-site-settings.ts`

**Interfaces:**
- Consumes: `NavLink`, `cleanNavLinks` from `src/lib/site-settings/clean-nav-links.ts` (Task 2); `createClient` from `@/lib/supabase/server`.
- Produces:
  - `SITE_SETTINGS_ID: string` (the fixed row id)
  - `type SiteSettingsData = { siteName: string; navLinks: NavLink[] }`
  - `getSiteSettings(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SiteSettingsData>`
  - `updateSiteSettings(siteName: string, navLinks: NavLink[]): Promise<{ error: string } | { success: true }>`
  - Task 4 imports `SiteSettingsData`, `getSiteSettings`, and `updateSiteSettings`. Task 5 imports `SiteSettingsData` and `getSiteSettings`.

- [ ] **Step 1: Write the data wrapper**

Create `src/lib/site-settings/get-site-settings.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import type { NavLink } from "./clean-nav-links";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const SITE_SETTINGS_ID = "00000000-0000-4000-8000-0000000000f1";

export type SiteSettingsData = {
  siteName: string;
  navLinks: NavLink[];
};

const DEFAULT_SITE_SETTINGS: SiteSettingsData = {
  siteName: "HemoEdge",
  navLinks: [
    { label: "Blog", href: "/blog" },
    { label: "Team", href: "/team" },
    { label: "Contact", href: "/contact" },
  ],
};

export async function getSiteSettings(supabase: SupabaseClient): Promise<SiteSettingsData> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, nav_links")
      .eq("id", SITE_SETTINGS_ID)
      .maybeSingle();

    if (error || !data) return DEFAULT_SITE_SETTINGS;
    return {
      siteName: data.site_name,
      navLinks: (data.nav_links as NavLink[]) ?? [],
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
```

- [ ] **Step 2: Write the update action**

Create `src/lib/site-settings/update-site-settings.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanNavLinks, type NavLink } from "./clean-nav-links";
import { SITE_SETTINGS_ID } from "./get-site-settings";

export async function updateSiteSettings(
  siteName: string,
  navLinks: NavLink[],
): Promise<{ error: string } | { success: true }> {
  const trimmedName = siteName.trim();
  if (!trimmedName) return { error: "Site name is required." };

  const cleaned = cleanNavLinks(navLinks);

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ site_name: trimmedName, nav_links: cleaned, updated_at: new Date().toISOString() })
    .eq("id", SITE_SETTINGS_ID);

  if (error) return { error: "Something went wrong — check your connection and try again." };

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/team");
  revalidatePath("/contact");
  revalidatePath("/admin/site-settings");
  return { success: true };
}
```

Neither function is unit-tested directly — both are thin Supabase-calling wrappers with no branching logic worth mocking beyond what `cleanNavLinks` (already tested in Task 2) and the required-name check already cover. Proven correct via Task 6's live verification.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/site-settings/get-site-settings.ts src/lib/site-settings/update-site-settings.ts
git commit -m "Add getSiteSettings wrapper and updateSiteSettings action"
```

---

### Task 4: Admin page and form

**Files:**
- Create: `src/app/admin/site-settings/site-settings-form.tsx`
- Modify: `src/app/admin/site-settings/page.tsx`

**Interfaces:**
- Consumes: `SiteSettingsData`, `getSiteSettings`, `updateSiteSettings` (Task 3); `NavLink` (Task 2); `getCurrentProfile` from `@/lib/auth/get-profile`; `ComingSoon` from `@/components/coming-soon`.
- Produces: `export function SiteSettingsForm({ initial }: { initial: SiteSettingsData })`.

- [ ] **Step 1: Create the form**

Create `src/app/admin/site-settings/site-settings-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { NavLink } from "@/lib/site-settings/clean-nav-links";
import type { SiteSettingsData } from "@/lib/site-settings/get-site-settings";
import { updateSiteSettings } from "@/lib/site-settings/update-site-settings";

const MAX_NAV_LINKS = 8;

type EditableLink = NavLink & { id: string };

function toEditable(links: NavLink[]): EditableLink[] {
  return links.map((l) => ({ ...l, id: crypto.randomUUID() }));
}

export function SiteSettingsForm({ initial }: { initial: SiteSettingsData }) {
  const [siteName, setSiteName] = useState(initial.siteName);
  const [links, setLinks] = useState<EditableLink[]>(() => toEditable(initial.navLinks));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function updateLink(id: string, field: "label" | "href", value: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), label: "", href: "" }]);
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const result = await updateSiteSettings(
      siteName,
      links.map(({ label, href }) => ({ label, href })),
    );
    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="site-name">
          Site name
        </label>
        <input
          id="site-name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-ink-dim">Navigation &amp; footer links</span>
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2">
            <input
              placeholder="Label"
              aria-label="Link label"
              value={link.label}
              onChange={(e) => updateLink(link.id, "label", e.target.value)}
              className="w-40 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <input
              placeholder="/href"
              aria-label="Link URL"
              value={link.href}
              onChange={(e) => updateLink(link.id, "href", e.target.value)}
              className="w-48 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLink(link.id)}
              className="text-xs text-danger underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addLink}
          disabled={links.length >= MAX_NAV_LINKS}
          className="self-start text-xs text-info-soft-ink underline disabled:opacity-50"
        >
          Add link
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">Saved.</p>}
    </form>
  );
}
```

Each link row gets a client-only `id` (via `crypto.randomUUID()`) distinct from `label`/`href`, so React tracks row identity correctly across removals instead of relying on array index as key — the `id` is stripped back out before calling `updateSiteSettings`.

- [ ] **Step 2: Rewrite the page**

Read `src/app/admin/site-settings/page.tsx` first (it's currently the 11-line `<ComingSoon>` stub) to confirm nothing else has changed it, then replace its entire contents with:

```tsx
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ComingSoon } from "@/components/coming-soon";
import { getSiteSettings } from "@/lib/site-settings/get-site-settings";
import { SiteSettingsForm } from "./site-settings-form";

export default async function SiteSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="Site settings are managed by HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);

  return (
    <div>
      <h1 className="text-xl font-semibold">Site Settings</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Logo, navigation, and footer links for the public marketing site.
      </p>

      <div className="mt-6 max-w-xl rounded-lg border border-line p-4">
        <SiteSettingsForm initial={siteSettings} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/app/admin/site-settings/site-settings-form.tsx src/app/admin/site-settings/page.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/site-settings/site-settings-form.tsx src/app/admin/site-settings/page.tsx
git commit -m "Build the Site Settings admin form (name + link list editor)"
```

---

### Task 5: Wire PublicNav/PublicFooter and all 6 marketing pages

**Files:**
- Modify: `src/components/public-nav.tsx`
- Modify: `src/components/public-footer.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/team/page.tsx`
- Modify: `src/app/contact/page.tsx`
- Modify: `src/app/blog/page.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`
- Modify: `src/app/[slug]/page.tsx`

**Interfaces:**
- Consumes: `SiteSettingsData`, `getSiteSettings` (Task 3).
- Produces: `PublicNav({ siteSettings }: { siteSettings: SiteSettingsData })` and `PublicFooter({ siteSettings }: { siteSettings: SiteSettingsData })` — both now prop-driven instead of hardcoded. This is the task where the feature becomes visible on the actual marketing site.

- [ ] **Step 1: Rewrite `PublicNav`**

Read `src/components/public-nav.tsx` first to confirm its current content, then replace the whole file with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SiteSettingsData } from "@/lib/site-settings/get-site-settings";

export function PublicNav({ siteSettings }: { siteSettings: SiteSettingsData }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { siteName, navLinks } = siteSettings;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {siteName}
        </Link>
        <div className="flex items-center gap-6 text-sm text-ink-dim">
          {navLinks.map((link) => (
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
            {navLinks.map((link) => (
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
```

- [ ] **Step 2: Rewrite `PublicFooter`**

Read `src/components/public-footer.tsx` first, then replace the whole file with:

```tsx
import Link from "next/link";
import type { SiteSettingsData } from "@/lib/site-settings/get-site-settings";

export function PublicFooter({ siteSettings }: { siteSettings: SiteSettingsData }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-sm text-ink-dim sm:flex-row sm:justify-between">
        <span>
          &copy; {new Date().getFullYear()} {siteSettings.siteName}
        </span>
        <nav aria-label="Footer" className="flex items-center gap-5">
          {siteSettings.navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Wire `src/app/page.tsx`**

Add the import:

```tsx
import { getSiteSettings } from "@/lib/site-settings/get-site-settings";
```

Replace:

```tsx
export default async function Home() {
  const supabase = await createClient();

  const { data: homepage } = await supabase
```

with:

```tsx
export default async function Home() {
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);

  const { data: homepage } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />` (each appears once in this file).

- [ ] **Step 4: Wire `src/app/team/page.tsx`**

Add the import `import { getSiteSettings } from "@/lib/site-settings/get-site-settings";`.

Replace:

```tsx
export default async function TeamPage() {
  const supabase = await createClient();
  const { data: associates } = await supabase
```

with:

```tsx
export default async function TeamPage() {
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);
  const { data: associates } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />`.

- [ ] **Step 5: Wire `src/app/contact/page.tsx`**

Add the import `import { getSiteSettings } from "@/lib/site-settings/get-site-settings";`.

Replace:

```tsx
export default async function ContactPage() {
  const supabase = await createClient();
  const { data: page } = await supabase
```

with:

```tsx
export default async function ContactPage() {
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);
  const { data: page } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />`.

- [ ] **Step 6: Wire `src/app/blog/page.tsx`**

Add the import `import { getSiteSettings } from "@/lib/site-settings/get-site-settings";`.

Replace:

```tsx
export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
```

with:

```tsx
export default async function BlogIndexPage() {
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);
  const { data: posts } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />`.

- [ ] **Step 7: Wire `src/app/blog/[slug]/page.tsx`**

Add the import `import { getSiteSettings } from "@/lib/site-settings/get-site-settings";`.

Replace:

```tsx
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
```

with:

```tsx
  const { slug } = await params;
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);

  const { data: post } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />`.

- [ ] **Step 8: Wire `src/app/[slug]/page.tsx`**

Add the import `import { getSiteSettings } from "@/lib/site-settings/get-site-settings";`.

Replace:

```tsx
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
```

with:

```tsx
  const { slug } = await params;
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);

  const { data: page } = await supabase
```

Replace `<PublicNav />` with `<PublicNav siteSettings={siteSettings} />` and `<PublicFooter />` with `<PublicFooter siteSettings={siteSettings} />`.

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. This step is where a missed `<PublicNav />` call site (still passing no props) would surface as a type error — if it doesn't error, double check with `grep -rn "<PublicNav />\|<PublicFooter />" src/app` that no bare (prop-less) call sites remain anywhere in `src/app`.

Run: `npx eslint src/components/public-nav.tsx src/components/public-footer.tsx src/app/page.tsx src/app/team/page.tsx src/app/contact/page.tsx src/app/blog/page.tsx "src/app/blog/[slug]/page.tsx" "src/app/[slug]/page.tsx"`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/public-nav.tsx src/components/public-footer.tsx src/app/page.tsx src/app/team/page.tsx src/app/contact/page.tsx src/app/blog/page.tsx "src/app/blog/[slug]/page.tsx" "src/app/[slug]/page.tsx"
git commit -m "Wire PublicNav/PublicFooter and all marketing pages to site_settings"
```

---

### Task 6: Live verification

**Files:** none (throwaway verification script only, not committed)

**Interfaces:**
- Consumes: the running dev server and the live `site_settings` singleton row (id `00000000-0000-4000-8000-0000000000f1`), which this task temporarily edits and restores.
- Produces: nothing shipped — screenshots sent via `SendUserFile`, a pass/fail report, and the `site_settings` row restored to its seeded defaults afterward.

Note: this demo database currently has zero rows in `public.pages` (confirmed via `select * from public.pages` before writing this plan), so there is no published `/[slug]` custom page to test against. Verify via the four fixed routes (`/`, `/blog`, `/team`, `/contact`) only — do not attempt to create a throwaway `pages` row just to exercise this one route, since `[slug]`'s wiring is identical in kind to the other 5 already-verified pages (same `getSiteSettings` call, same prop pass-through) and adds no new code path worth a special case.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)
Wait for it to report ready (poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` until non-`000`).

- [ ] **Step 2: Write and run the verification script**

Write to `node_modules/.tmp-site-settings-verify.mjs` (Chromium launched with `args: ["--ignore-certificate-errors"]` for this sandbox's TLS-intercepting proxy, per the established fix from the header-search and notifications-bell plans):

```js
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "HemoDemo2026!";

async function loginAs(page, email) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--ignore-certificate-errors"],
});

// 1. Non-super-admins see the ComingSoon gate, not the form.
for (const email of [
  "demo.contentmanager@optymumss.com",
  "demo.orgadmin@optymumss.com",
  "demo.learner@optymumss.com",
]) {
  const page = await browser.newPage();
  await loginAs(page, email);
  await page.goto(`${BASE_URL}/admin/site-settings`);
  const gated = await page.getByText("Super Admin only").isVisible().catch(() => false);
  if (!gated) throw new Error(`FAIL: ${email} should see the Super Admin only gate`);
  await page.close();
}

// 2. Super admin edits the site name and links.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.superadmin@optymumss.com");
  await page.goto(`${BASE_URL}/admin/site-settings`);

  const nameInput = page.getByLabel("Site name");
  await nameInput.fill("HemoEdge Verify");

  const labelInputs = page.getByLabel("Link label");
  const hrefInputs = page.getByLabel("Link URL");
  await labelInputs.nth(0).fill("Blog Verify");
  await hrefInputs.nth(0).fill("/blog");

  await page.getByRole("button", { name: "Add link" }).click();
  const newIndex = (await labelInputs.count()) - 1;
  await labelInputs.nth(newIndex).fill("Pricing");
  await hrefInputs.nth(newIndex).fill("/pricing");

  await page.getByRole("button", { name: "Save" }).click();
  const saved = await page.getByText("Saved.").isVisible().catch(() => false);
  if (!saved) throw new Error("FAIL: expected a 'Saved.' confirmation after submitting");
  await page.close();
}

// 3. The change appears on the public marketing site, even logged out.
{
  const page = await browser.newPage(); // fresh context, never logged in
  for (const path of ["/", "/blog", "/team", "/contact"]) {
    await page.goto(`${BASE_URL}${path}`);
    const nameVisible = await page.getByText("HemoEdge Verify", { exact: true }).first().isVisible().catch(() => false);
    if (!nameVisible) throw new Error(`FAIL: ${path} should show the updated site name while logged out`);
    const pricingVisible = await page.getByRole("link", { name: "Pricing" }).first().isVisible().catch(() => false);
    if (!pricingVisible) throw new Error(`FAIL: ${path} should show the new "Pricing" link while logged out`);
  }
  await page.screenshot({ path: "/tmp/site-settings-public-light.png" });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/site-settings-public-dark.png" });
  await page.close();
}

// 4. Screenshots of the admin form itself, light/dark/mobile.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.superadmin@optymumss.com");
  await page.goto(`${BASE_URL}/admin/site-settings`);
  await page.screenshot({ path: "/tmp/site-settings-admin-light.png" });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/site-settings-admin-dark.png" });
  await page.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await loginAs(mobilePage, "demo.superadmin@optymumss.com");
  await mobilePage.goto(`${BASE_URL}/admin/site-settings`);
  await mobilePage.screenshot({ path: "/tmp/site-settings-admin-mobile.png" });
  await mobilePage.close();
}

await browser.close();
console.log("ALL CHECKS PASSED");
```

Run: `node --env-file=.env.local node_modules/.tmp-site-settings-verify.mjs`
Expected: `ALL CHECKS PASSED` printed. If `getByLabel("Site name")`, `getByLabel("Link label")`, or `getByLabel("Link URL")` don't resolve, confirm the actual rendered `aria-label`/`htmlFor`/`id` attributes in `site-settings-form.tsx` match — do not guess a second time blindly.

- [ ] **Step 3: Send screenshots**

Send `/tmp/site-settings-public-light.png`, `/tmp/site-settings-public-dark.png`, `/tmp/site-settings-admin-light.png`, `/tmp/site-settings-admin-dark.png`, and `/tmp/site-settings-admin-mobile.png` via `SendUserFile`.

- [ ] **Step 4: Restore the original site settings and clean up**

Run via `mcp__Supabase__execute_sql` against project `uktdipvvnbgzasqlpudl`:

```sql
update public.site_settings
set site_name = 'HemoEdge',
    nav_links = '[{"label":"Blog","href":"/blog"},{"label":"Team","href":"/team"},{"label":"Contact","href":"/contact"}]'::jsonb,
    updated_at = now()
where id = '00000000-0000-4000-8000-0000000000f1';
```

Verify the restore:

```sql
select site_name, nav_links from public.site_settings where id = '00000000-0000-4000-8000-0000000000f1';
```

Expected: `site_name = 'HemoEdge'`, `nav_links` back to the original 3-item array.

Delete the throwaway script:

```bash
rm node_modules/.tmp-site-settings-verify.mjs
```

Stop the dev server.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (130 pre-existing + 7 new from Task 2 = 137/137).

---

## Final check

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx vitest run` — 137/137 passing
- [ ] Live verification script printed `ALL CHECKS PASSED`
- [ ] `site_settings` row confirmed restored to its seeded defaults
- [ ] Screenshots sent to the user
