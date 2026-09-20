# Learner Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the validated gaps between the live learner dashboard (`src/app/app/page.tsx`) and the cofounder's reference design: a conditionally-absent WSI viewer card, a duplicate greeting heading, and flat cards lacking the reference's icons, hero gradient, and Recently Earned certificates list.

**Architecture:** Two new server-side data wrappers (a WSI-slide fallback and a recent-certificates query), one small shared presentational component (`IconBadge`, extracted from `StatTile`'s existing markup) to avoid duplicating the accent-color treatment across StatTile and the new Quick Access icons, and two new presentational components (`DashboardHeroCard`, `RecentCertificates`). `src/app/app/page.tsx` is then reassembled to use all of the above and drop its duplicate heading.

**Tech Stack:** Next.js App Router (server components), Supabase (Postgres + RLS), Tailwind CSS with this codebase's CSS-variable-backed color tokens (`--accent`, `--danger-soft`, etc.), Vitest.

## Global Constraints

- Scope is the learner `/app` dashboard only — do not touch `/org` or `/admin`.
- No new "Question Bank" Quick Access tile — no such feature exists in this codebase; Quick Access stays at 3 real tiles (Modules, Case Studies, Library).
- Quick Access accent colors, exactly: Modules → `red`, Case Studies → `orange`, Library → `purple` (skip `green`).
- The CPD progress ring (`certificate-progress-ring.tsx`) is **not** touched — its "solid ring at 100%" appearance is correct math, not a bug (see spec).
- Recently Earned certificates: show up to 2 (`issued_at` descending), and hide the whole "Recently Earned" block when the learner has zero certificates — no empty-state message.
- The WSI viewer fallback tries, in order, stopping at the first hit: (1) org's newest published case with a `slide_id`, (2) org's newest published module whose earliest-position lesson has a `slide_id`, (3) if the org has no qualifying content (or there's no org), the same two queries again with no org filter.
- The hero card's decorative background must be a CSS gradient plus a **fixed** (non-random) inline SVG — no raster image assets, and no `Math.random()` or similar at render time (that would cause a server/client hydration mismatch in a server component rendered per-request... more precisely: any per-render randomness would make the markup non-deterministic, which this codebase's server components avoid).
- Every new data-wrapper function (`getFallbackPreviewSlide`, `getRecentCertificates`) follows this codebase's exception-safe convention: catch internally, return `null`/`[]`, never throw.

---

### Task 1: Pure logic — `pickNewerCandidate`

**Files:**
- Create: `src/lib/learner/pick-newer-candidate.ts`
- Test: `src/lib/learner/pick-newer-candidate.test.ts`

**Interfaces:**
- Produces: `FallbackCandidate` type and `pickNewerCandidate(a, b)` — used by Task 2's `getFallbackPreviewSlide`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/learner/pick-newer-candidate.test.ts
import { describe, it, expect } from "vitest";
import { pickNewerCandidate, type FallbackCandidate } from "./pick-newer-candidate";

const make = (createdAt: string): FallbackCandidate => ({
  slideId: "slide-1",
  title: "Some title",
  href: "/app/cases/1",
  createdAt,
});

describe("pickNewerCandidate", () => {
  it("returns null when both are null", () => {
    expect(pickNewerCandidate(null, null)).toBeNull();
  });

  it("returns a when only a is non-null", () => {
    const a = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(a, null)).toBe(a);
  });

  it("returns b when only b is non-null", () => {
    const b = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(null, b)).toBe(b);
  });

  it("returns a when a is newer than b", () => {
    const a = make("2026-06-01T00:00:00Z");
    const b = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(a, b)).toBe(a);
  });

  it("returns b when b is newer than a", () => {
    const a = make("2026-01-01T00:00:00Z");
    const b = make("2026-06-01T00:00:00Z");
    expect(pickNewerCandidate(a, b)).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/learner/pick-newer-candidate.test.ts`
Expected: FAIL — `Cannot find module './pick-newer-candidate'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/learner/pick-newer-candidate.ts
export type FallbackCandidate = {
  slideId: string;
  title: string;
  href: string;
  createdAt: string;
};

export function pickNewerCandidate(
  a: FallbackCandidate | null,
  b: FallbackCandidate | null,
): FallbackCandidate | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime() ? a : b;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/learner/pick-newer-candidate.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add src/lib/learner/pick-newer-candidate.ts src/lib/learner/pick-newer-candidate.test.ts
git commit -m "Add pure logic for picking the newer of two fallback slide candidates"
```

---

### Task 2: WSI viewer fallback data wrapper

**Files:**
- Create: `src/lib/learner/get-fallback-preview-slide.ts`

**Interfaces:**
- Consumes: `pickNewerCandidate`, `FallbackCandidate` from Task 1.
- Produces: `getFallbackPreviewSlide(supabase, orgId): Promise<{ slideId: string; title: string; href: string } | null>` — consumed by Task 8 (page assembly).

This is a thin Supabase-calling wrapper (no branching logic worth unit-testing beyond Task 1's pure comparison) — proven correct by live verification in Task 9, per this codebase's established convention for these wrappers.

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/learner/get-fallback-preview-slide.ts
import { createClient } from "@/lib/supabase/server";
import { pickNewerCandidate, type FallbackCandidate } from "./pick-newer-candidate";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getNewestCaseWithSlide(
  supabase: Supabase,
  caseIds: string[] | null,
): Promise<FallbackCandidate | null> {
  const query = supabase
    .from("cases")
    .select("id, title, slide_id, created_at")
    .eq("status", "published")
    .not("slide_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const { data } = await (caseIds ? query.in("id", caseIds) : query).maybeSingle();
  if (!data?.slide_id) return null;
  return { slideId: data.slide_id, title: data.title, href: `/app/cases/${data.id}`, createdAt: data.created_at };
}

async function getNewestModuleWithSlide(
  supabase: Supabase,
  moduleIds: string[] | null,
): Promise<FallbackCandidate | null> {
  const query = supabase
    .from("modules")
    .select("id, title, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: modules } = await (moduleIds ? query.in("id", moduleIds) : query);

  for (const m of modules ?? []) {
    const { data: lesson } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", m.id)
      .not("slide_id", "is", null)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (lesson?.slide_id) {
      return { slideId: lesson.slide_id, title: lesson.title, href: `/app/modules/${m.id}`, createdAt: m.created_at };
    }
  }
  return null;
}

async function getOrgScopedFallback(
  supabase: Supabase,
  orgId: string,
): Promise<FallbackCandidate | null> {
  const { data: selections } = await supabase
    .from("org_catalog_selections")
    .select("content_id, content_type")
    .eq("org_id", orgId)
    .in("content_type", ["case", "module"]);

  const caseIds = (selections ?? []).filter((s) => s.content_type === "case").map((s) => s.content_id);
  const moduleIds = (selections ?? []).filter((s) => s.content_type === "module").map((s) => s.content_id);

  return pickNewerCandidate(
    caseIds.length > 0 ? await getNewestCaseWithSlide(supabase, caseIds) : null,
    moduleIds.length > 0 ? await getNewestModuleWithSlide(supabase, moduleIds) : null,
  );
}

/**
 * Guarantees the dashboard's Whole Slide Viewer card always has a slide to
 * show when the platform has any published content with one, even when the
 * learner's own study recommendation doesn't resolve to a slide. Only fills
 * in the WSI card — the "Continue Learning"/"Study Next" hero card is a
 * separate concern and keeps hiding itself when there's genuinely nothing to
 * recommend.
 */
export async function getFallbackPreviewSlide(
  supabase: Supabase,
  orgId: string | null,
): Promise<{ slideId: string; title: string; href: string } | null> {
  try {
    const orgScoped = orgId ? await getOrgScopedFallback(supabase, orgId) : null;
    const result =
      orgScoped ??
      pickNewerCandidate(await getNewestCaseWithSlide(supabase, null), await getNewestModuleWithSlide(supabase, null));
    return result ? { slideId: result.slideId, title: result.title, href: result.href } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/learner/get-fallback-preview-slide.ts
git commit -m "Add fallback slide lookup so the dashboard WSI card always has content"
```

---

### Task 3: Recently Earned certificates data wrapper

**Files:**
- Create: `src/lib/learner/get-recent-certificates.ts`

**Interfaces:**
- Produces: `RecentCertificate` type and `getRecentCertificates(supabase, userId, limit): Promise<RecentCertificate[]>` — consumed by Task 6 (`RecentCertificates` component) and Task 8 (page assembly).

Matches the existing `certificates` query pattern in `src/app/app/certificates/page.tsx` (preferring `curricula.certificate_title` over `curricula.title` when set).

- [ ] **Step 1: Write the implementation**

```ts
// src/lib/learner/get-recent-certificates.ts
import { createClient } from "@/lib/supabase/server";

export type RecentCertificate = { id: string; title: string; issuedAt: string };

export async function getRecentCertificates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
): Promise<RecentCertificate[]> {
  try {
    const { data } = await supabase
      .from("certificates")
      .select("id, issued_at, curricula(title, certificate_title)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((c) => ({
      id: c.id,
      title: c.curricula?.certificate_title || c.curricula?.title || "Untitled certificate",
      issuedAt: c.issued_at,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/learner/get-recent-certificates.ts
git commit -m "Add recent-certificates lookup for the dashboard's Recently Earned list"
```

---

### Task 4: Shared `IconBadge` + `StatTile` refactor

**Files:**
- Create: `src/components/dashboard/accent-colors.ts`
- Create: `src/components/dashboard/icon-badge.tsx`
- Modify: `src/components/dashboard/stat-tile.tsx`

**Interfaces:**
- Produces: `AccentColor` type, `ACCENT_ICON_CLASSES` map, and `IconBadge({ icon, accentColor })` — consumed by the refactored `StatTile` in this task and by the new Quick Access tiles in Task 5.

This is a pure extraction: `StatTile`'s visual output is unchanged (confirmed in Task 9's live verification), it just now composes `IconBadge` instead of inlining the same markup. The sparkline's color map (`stroke-*`) stays local to `stat-tile.tsx` since nothing else needs it.

- [ ] **Step 1: Create the shared accent-color map**

```ts
// src/components/dashboard/accent-colors.ts
export type AccentColor = "red" | "orange" | "green" | "purple";

export const ACCENT_ICON_CLASSES: Record<AccentColor, string> = {
  red: "bg-danger-soft text-danger-soft-ink",
  orange: "bg-warning-soft text-warning-soft-ink",
  green: "bg-success-soft text-success-soft-ink",
  purple: "bg-accent-soft text-accent-soft-ink",
};
```

- [ ] **Step 2: Create `IconBadge`**

```tsx
// src/components/dashboard/icon-badge.tsx
import type { ReactNode } from "react";
import { ACCENT_ICON_CLASSES, type AccentColor } from "./accent-colors";

export function IconBadge({ icon, accentColor }: { icon: ReactNode; accentColor: AccentColor }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ACCENT_ICON_CLASSES[accentColor]}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}
```

- [ ] **Step 3: Refactor `StatTile` to use it**

Read `src/components/dashboard/stat-tile.tsx` first to confirm current content, then replace it with:

```tsx
// src/components/dashboard/stat-tile.tsx
import type { Sparkline } from "@/lib/trends/trend-math";
import { IconBadge } from "./icon-badge";
import type { AccentColor } from "./accent-colors";

const SPARK_CLASSES: Record<AccentColor, string> = {
  red: "stroke-danger",
  orange: "stroke-warning",
  green: "stroke-success",
  purple: "stroke-accent",
};

const DIRECTION_TEXT: Record<"up" | "down" | "flat", string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-ink-faint",
};

function SparklinePath({ points, className }: { points: number[]; className: string }) {
  const max = Math.max(...points, 1);
  const width = 100;
  const height = 24;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - (p / max) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" strokeWidth="2" className={className} />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  icon,
  changeLabel,
  direction,
  sparkline,
  accentColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  changeLabel: string;
  direction: "up" | "down" | "flat";
  sparkline: Sparkline;
  accentColor: AccentColor;
}) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-center gap-2">
        <IconBadge icon={icon} accentColor={accentColor} />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className={`text-xs ${DIRECTION_TEXT[direction]}`}>{changeLabel}</p>
      <div className="mt-2">
        <SparklinePath points={sparkline.points} className={SPARK_CLASSES[accentColor]} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify nothing else breaks**

Run: `npx tsc --noEmit`
Expected: clean — `page.tsx` passes `accentColor: "red" as const` etc., which is assignable to the now-imported `AccentColor` type.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/accent-colors.ts src/components/dashboard/icon-badge.tsx src/components/dashboard/stat-tile.tsx
git commit -m "Extract shared IconBadge from StatTile for reuse in Quick Access"
```

---

### Task 5: Quick Access icons

**Files:**
- Modify: `src/components/dashboard/stat-icons.tsx`
- Modify: `src/app/app/page.tsx`

**Interfaces:**
- Consumes: `IconBadge`, `AccentColor` from Task 4.
- Produces: `LibraryIcon` added to `stat-icons.tsx` (Modules/Case Studies reuse the existing `ModuleIcon`/`CaseIcon`, already imported in `page.tsx` for the stat tiles — avoids near-duplicate icons).

- [ ] **Step 1: Add `LibraryIcon`**

Append to `src/components/dashboard/stat-icons.tsx`:

```tsx
export function LibraryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 13.5V3.5a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 13.5V3.5a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 13.5V4.9a1 1 0 0 1 .76-.97l1.5-.375a1 1 0 0 1 1.24.97V13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M2 13.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Update `QUICK_LINKS` and its rendering in `page.tsx`**

Read `src/app/app/page.tsx` first to confirm current line numbers, then:

Change the icon import line:

```ts
import { ModuleIcon, CaseIcon, PassRateIcon, SlideIcon, LibraryIcon } from "@/components/dashboard/stat-icons";
```

Add this import alongside the other dashboard component imports:

```ts
import { IconBadge } from "@/components/dashboard/icon-badge";
```

Replace the `QUICK_LINKS` array:

```ts
const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content", icon: <ModuleIcon />, accentColor: "red" as const },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios", icon: <CaseIcon />, accentColor: "orange" as const },
  { label: "Library", href: "/app/library", blurb: "Browse the slide collection", icon: <LibraryIcon />, accentColor: "purple" as const },
];
```

Replace the Quick Access rendering block:

```tsx
<div className="mt-3 grid gap-3 sm:grid-cols-3">
  {QUICK_LINKS.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="flex items-center gap-3 rounded-lg border border-line p-4 hover:border-line-strong"
    >
      <IconBadge icon={link.icon} accentColor={link.accentColor} />
      <div>
        <p className="font-medium text-ink">{link.label}</p>
        <p className="mt-1 text-sm text-ink-dim">{link.blurb}</p>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/stat-icons.tsx src/app/app/page.tsx
git commit -m "Add icons to the dashboard's Quick Access links"
```

---

### Task 6: `RecentCertificates` component

**Files:**
- Create: `src/components/dashboard/recent-certificates.tsx`

**Interfaces:**
- Consumes: `RecentCertificate` type from Task 3.
- Produces: `RecentCertificates({ certificates })` — consumed by Task 8 (page assembly).

- [ ] **Step 1: Write the component**

```tsx
// src/components/dashboard/recent-certificates.tsx
import Link from "next/link";
import type { RecentCertificate } from "@/lib/learner/get-recent-certificates";

export function RecentCertificates({ certificates }: { certificates: RecentCertificate[] }) {
  if (certificates.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Recently Earned</p>
      <div className="mt-3 flex flex-col gap-3">
        {certificates.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{c.title}</p>
              <p className="text-xs text-ink-faint">Earned on {new Date(c.issuedAt).toLocaleDateString()}</p>
            </div>
            <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-ink">
              Earned
            </span>
          </div>
        ))}
      </div>
      <Link href="/app/certificates" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
        Browse all certificates &rarr;
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/recent-certificates.tsx
git commit -m "Add RecentCertificates component for the dashboard"
```

---

### Task 7: `DashboardHeroCard` component

**Files:**
- Create: `src/components/dashboard/dashboard-hero-card.tsx`

**Interfaces:**
- Consumes: `SlideProgress` type from `@/lib/learner/module-slide-progress` (already exists).
- Produces: `DashboardHeroCard({ label, title, context, slideProgress, ctaHref, ctaLabel })` — consumed by Task 8 (page assembly), replacing the inline recommendation-card markup currently in `page.tsx`.

The decorative background is a fixed (non-random) inline SVG circle scatter plus a token-driven gradient — no new image assets, themes correctly via the existing `--accent`/`--accent-soft` CSS variables.

- [ ] **Step 1: Write the component**

```tsx
// src/components/dashboard/dashboard-hero-card.tsx
import Link from "next/link";
import type { SlideProgress } from "@/lib/learner/module-slide-progress";

export function DashboardHeroCard({
  label,
  title,
  context,
  slideProgress,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  title: string;
  context?: string | null;
  slideProgress: SlideProgress | null;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line p-4 lg:col-span-2">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-accent opacity-[0.08]"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <circle cx="40" cy="40" r="28" fill="currentColor" />
        <circle cx="120" cy="90" r="36" fill="currentColor" />
        <circle cx="90" cy="150" r="20" fill="currentColor" />
        <circle cx="210" cy="50" r="18" fill="currentColor" />
        <circle cx="260" cy="120" r="44" fill="currentColor" />
        <circle cx="330" cy="60" r="24" fill="currentColor" />
        <circle cx="360" cy="150" r="30" fill="currentColor" />
        <circle cx="180" cy="170" r="14" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-br from-accent-soft via-transparent to-transparent" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
        <p className="mt-2 text-lg font-medium text-ink">{title}</p>
        {context && <p className="mt-1 text-sm text-ink-dim">{context}</p>}
        {slideProgress && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${slideProgress.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {slideProgress.completed} of {slideProgress.total} slides completed &middot; {slideProgress.percent}%
            </p>
          </div>
        )}
        <Link href={ctaHref} className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
          {ctaLabel} &rarr;
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/dashboard-hero-card.tsx
git commit -m "Add DashboardHeroCard with gradient/pattern styling"
```

---

### Task 8: Assemble the page

**Files:**
- Modify: `src/app/app/page.tsx`

**Interfaces:**
- Consumes: `getFallbackPreviewSlide` (Task 2), `getRecentCertificates` (Task 3), `RecentCertificates` (Task 6), `DashboardHeroCard` (Task 7).

This task removes the duplicate heading, wires in the WSI fallback, and wires in the Recently Earned list. It does not change `RecentQuizScores` or the "Modules & Cases" summary card.

- [ ] **Step 1: Add the new imports**

Read `src/app/app/page.tsx` first to confirm current line numbers (Tasks 5 already touched the top of this file), then add:

```ts
import { getFallbackPreviewSlide } from "@/lib/learner/get-fallback-preview-slide";
import { getRecentCertificates } from "@/lib/learner/get-recent-certificates";
import { RecentCertificates } from "@/components/dashboard/recent-certificates";
import { DashboardHeroCard } from "@/components/dashboard/dashboard-hero-card";
```

- [ ] **Step 2: Fetch recent certificates alongside the existing `Promise.all`**

In the existing `Promise.all([...])` call (the one fetching `modules, cases, certificatesResult, recommendation, certificateProgress, dashboardTrends, recentAttempts`), add `getRecentCertificates(supabase, userId!, 2)` as a new element, and add `recentCertificates` to the destructured result array in the matching position.

- [ ] **Step 3: Add the WSI fallback after the existing `previewSlide` derivation**

Immediately after the `if (recommendation.kind === "module") { ... } else if (recommendation.kind === "case") { ... }` block that sets `previewSlide`, add:

```ts
if (!previewSlide) {
  const fallback = await getFallbackPreviewSlide(supabase, orgId);
  if (fallback) previewSlide = fallback;
}
```

- [ ] **Step 4: Remove the duplicate heading**

Delete this block entirely:

```tsx
<h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
<p className="mt-2 max-w-xl text-sm text-ink-dim">
  {orgId ? "Here's what your organization has assigned." : "Here's what's available to study."}
</p>
```

`displayName` was only ever computed for this block, and `profile`/`impersonation` were only ever used to compute `displayName` — all three become fully unused once this block is gone. Remove these three lines too:

```ts
const profile = await getCurrentProfile();
const impersonation = await getActiveImpersonation();
const displayName = impersonation
  ? impersonation.target.fullName || impersonation.target.email
  : profile?.fullName || profile?.email;
```

`getEffectiveUserId()` (still needed for `userId`) stays. Update the import line that currently reads:

```ts
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
```

to:

```ts
import { getEffectiveUserId } from "@/lib/auth/impersonation";
```

and remove the now-fully-unused import entirely:

```ts
import { getCurrentProfile } from "@/lib/auth/get-profile";
```

`orgId` (from `getLearnerOrgId()`) stays as-is — it's still used by the data fetches and the new fallback call.

- [ ] **Step 5: Replace the inline hero card with `DashboardHeroCard`**

Replace:

```tsx
{recommendation.kind !== "none" && (
  <div className="rounded-lg border border-line p-4 lg:col-span-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
      {recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
    </p>
    <p className="mt-2 text-lg font-medium text-ink">{recommendation.title}</p>
    {"context" in recommendation && recommendation.context && (
      <p className="mt-1 text-sm text-ink-dim">{recommendation.context}</p>
    )}
    {slideProgress && (
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${slideProgress.percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-dim">
          {slideProgress.completed} of {slideProgress.total} slides completed &middot; {slideProgress.percent}%
        </p>
      </div>
    )}
    <Link
      href={recommendation.href}
      className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
    >
      {recommendation.kind === "module"
        ? recommendation.reason === "pathway"
          ? "Continue Module"
          : "Start Module"
        : "Start now"}{" "}
      &rarr;
    </Link>
  </div>
)}
```

with:

```tsx
{recommendation.kind !== "none" && (
  <DashboardHeroCard
    label={recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
    title={recommendation.title}
    context={"context" in recommendation ? recommendation.context : null}
    slideProgress={slideProgress}
    ctaHref={recommendation.href}
    ctaLabel={
      recommendation.kind === "module"
        ? recommendation.reason === "pathway"
          ? "Continue Module"
          : "Start Module"
        : "Start now"
    }
  />
)}
```

- [ ] **Step 6: Wire `RecentCertificates` into the certificates card**

Change:

```tsx
{certificateProgress && (
  <div className="lg:col-span-1">
    <CertificateProgressRing progress={certificateProgress} />
  </div>
)}
```

to:

```tsx
{certificateProgress && (
  <div className="lg:col-span-1">
    <CertificateProgressRing progress={certificateProgress} />
    <RecentCertificates certificates={recentCertificates} />
  </div>
)}
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/app/page.tsx`
Expected: both clean

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: 149/149 passing (144 pre-existing + 5 new from Task 1)

- [ ] **Step 9: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "Assemble the rebuilt learner dashboard: drop duplicate heading, wire WSI fallback and Recently Earned"
```

---

### Task 9: Live verification

**Files:** none (throwaway verification only, not committed)

**Interfaces:**
- Consumes: the running dev server; the demo learner account (`demo.learner@optymumss.com` / `HemoDemo2026!`); a second scenario with no certificates to confirm the Recently Earned list correctly hides.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background), redirecting output to a log file (e.g. `/tmp/nextdev.log`) so failures are visible.
Wait for it to report ready (poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` until non-`000`).

- [ ] **Step 2: Screenshot the demo learner's dashboard, light and dark**

Using Playwright with Chromium at `/opt/pw-browsers/chromium` and `args: ["--ignore-certificate-errors"]` (this sandbox's TLS-intercepting proxy — see `/root/.ccr/README.md`), write a throwaway script to `node_modules/.tmp-verify-dashboard.mjs` (so Node resolves `playwright` from the project's own `node_modules`) that:
1. Logs in as `demo.learner@optymumss.com` / `HemoDemo2026!`.
2. Navigates to `/app`.
3. Screenshots the full page.
4. Toggles the theme button and screenshots again.

Run: `node node_modules/.tmp-verify-dashboard.mjs`

- [ ] **Step 3: Confirm the fixed gaps, reading the screenshots**

Check, in both themes:
1. Only one greeting is visible (no "Welcome, {name}" below the header's "Good evening, {name}").
2. The Whole Slide Viewer card is present — since the demo learner's own recommendation may or may not resolve a slide, this specifically confirms the **fallback** path renders the card either way (compare against Task 8, Step 3's added fallback call).
3. The hero card ("Continue Learning"/"Study Next") shows the gradient + circle-pattern background.
4. Quick Access shows 3 tiles, each with a colored icon badge (Modules=red, Case Studies=orange, Library=purple).
5. If the demo account has any certificates, a "Recently Earned" list appears under the CPD ring with a working "Browse all certificates" link; stat tiles still render exactly as before (icon badge + value + trend + sparkline).

- [ ] **Step 4: Confirm the Recently Earned empty state**

Via `mcp__Supabase__execute_sql` against project `uktdipvvnbgzasqlpudl`, check whether the demo learner (`demo.learner@optymumss.com`) currently has any `certificates` rows. If they do, temporarily note this — do not delete real demo data. Instead, confirm the empty-hide behavior by reading `src/components/dashboard/recent-certificates.tsx`'s `if (certificates.length === 0) return null;` guard and cross-checking it against Task 3's `getRecentCertificates`, which returns `[]` on no rows — this is a direct, structural guarantee rather than something that needs a separate throwaway account to prove.

- [ ] **Step 5: Clean up**

```bash
rm node_modules/.tmp-verify-dashboard.mjs
```

Stop the dev server.

- [ ] **Step 6: Run the full test suite one more time**

Run: `npx vitest run`
Expected: 149/149 passing

## Final check

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx vitest run` — 149/149 passing
- [ ] Live verification screenshots (light + dark) confirm: single greeting, WSI card always present, gradient hero card, icon Quick Access tiles, Recently Earned list (or correctly hidden) — matching the reference design's intent
