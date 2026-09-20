# Learner Dashboard Rebuild — Design Spec

## Problem

The cofounder compared the live learner dashboard (`src/app/app/page.tsx` and its layout shell) against a reference design image and flagged it as "far from the reference" in layout, spacing, visual hierarchy, and overall polish. A live screenshot (demo learner account, both themes) confirmed the complaint is largely accurate, and surfaced one concrete defect beyond pure styling:

- **The Whole Slide Viewer card is conditionally absent.** `WsiViewerCard` only renders when `previewSlide` resolves from the learner's study recommendation. For the demo account tested, the recommendation was a case with no `slide_id`, so the card silently disappeared — while the reference always shows it.
- **A duplicate greeting.** `Header` renders "Good evening, {name} / You're doing great — keep up the momentum." and `page.tsx` separately renders its own "Welcome, {name}" heading directly below it. The reference shows only one greeting.
- **No visual hierarchy in the main content.** Every dashboard card is a flat `rounded-lg border border-line` box with plain gray uppercase labels: no gradient treatment on the recommendation card, no icons on Quick Access links, no "Recently Earned" certificates list, none of the reference's color/imagery rhythm.

One item flagged during initial triage — the CPD progress ring showing no visible background track — turned out **not** to be a defect: at exactly 100% complete, `strokeDashoffset` is `0`, so the accent-colored progress circle legitimately fully overlaps the track circle of the same radius and width. That's correct rendering for a fully-complete ring, not a bug, and needs no code change.

## Scope

The learner `/app` dashboard only (`src/app/app/page.tsx` and the components it composes). Not `/org` or `/admin` — those are separate dashboards outside what was reported. Not a new design-token system or shared component library beyond the one small extraction below; not a new Question Bank feature (the reference shows one, but no such feature or route exists anywhere in this codebase, and building one is a separate project from a visual rebuild).

## Data layer changes

### WSI viewer fallback: `src/lib/learner/get-fallback-preview-slide.ts`

Today, `page.tsx` derives `previewSlide` only from the study recommendation (a module's first lesson slide, or a case's own `slide_id`) and leaves it `null` if that doesn't resolve. This adds a fallback, invoked only when that derivation is still `null`:

```ts
export type FallbackCandidate = { slideId: string; title: string; href: string; createdAt: string };

export function pickNewerCandidate(
  a: FallbackCandidate | null,
  b: FallbackCandidate | null,
): FallbackCandidate | null
```

`pickNewerCandidate` is pure and unit-tested: returns whichever of `a`/`b` is non-null, or whichever has the later `createdAt` if both are non-null, or `null` if both are.

`getFallbackPreviewSlide(supabase, orgId)` tries, in order, stopping at the first non-null result:

1. The org's most recently created published **case** with a non-null `slide_id` (org-scoped via `org_catalog_selections`, same pattern as `getPublishedContent`).
2. The org's most recently created published **module** whose earliest-position `lesson` has a non-null `slide_id`.
3. If `orgId` is set but neither (1) nor (2) found anything (org has no qualifying catalog content), repeat (1) and (2) **without** the org filter — any published case/module platform-wide.

When both a case candidate and a module candidate resolve at the same step, `pickNewerCandidate` picks the newer one by `created_at`.

This only fills in the **WSI card's** slide. The recommendation ("Continue Learning" / "Study Next") hero card is unaffected and keeps its current behavior of hiding entirely when `recommendation.kind === "none"` — the ask was "the viewer card should always show," not "fabricate a fake recommendation" when there's genuinely nothing to recommend. In the fully-empty-platform edge case (no published content with any slide at all), the WSI card still won't render — there is nothing to show, which is correct.

### Recently Earned certificates: `src/lib/learner/get-recent-certificates.ts`

No existing wrapper returns this — `getCertificateProgress` only computes progress toward one in-flight curriculum. New function:

```ts
export type RecentCertificate = { id: string; title: string; issuedAt: string };

export async function getRecentCertificates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
): Promise<RecentCertificate[]>
```

Queries `certificates` joined to `curricula(title)`, filtered by `user_id`, ordered by `issued_at` descending, limited to `limit` (page passes `2`, matching the reference). Returns `[]` on no rows — the UI hides the "Recently Earned" section entirely when empty, per the earlier decision, rather than showing an empty-state message.

A pure `formatCertificateDate(issuedAt: string): string` helper (e.g. `"18 May 2025"`) lives alongside it, unit-tested, for consistent display formatting.

## Component changes

### Shared `IconBadge`: `src/components/dashboard/icon-badge.tsx`

Extracts the colored-square-icon markup that already exists inline in `stat-tile.tsx` (`<span className="flex h-7 w-7 items-center justify-center rounded-md ...">`) into its own component:

```ts
export function IconBadge({
  icon,
  accentColor,
}: {
  icon: React.ReactNode;
  accentColor: "red" | "orange" | "green" | "purple";
}): JSX.Element
```

The `ACCENT_CLASSES` icon-background/text map currently defined inside `stat-tile.tsx` moves to a shared `src/components/dashboard/accent-colors.ts`, so `StatTile` and the new Quick Access tiles read the same definition instead of duplicating it. `StatTile` is updated to use `IconBadge` in place of its inline markup — a pure refactor, no visual change to stat tiles.

### Quick Access icons

Three new small inline-SVG icons (matching the existing 16×16, `currentColor`-stroke style in `stat-icons.tsx`) for Modules, Case Studies, and Library — added to `stat-icons.tsx` alongside the existing four. Each `QUICK_LINKS` entry in `page.tsx` gains an `icon` and an `accentColor`: Modules → `red`, Case Studies → `orange`, Library → `purple` (skipping `green`; picked for visual distinction only — no semantic meaning like the stat tiles' trend-direction colors carry). Rendered via `IconBadge`. No fourth "Question Bank" tile.

### Hero card visual redesign

The existing recommendation card in `page.tsx` (the `rounded-lg border border-line p-4 lg:col-span-2` block) gets a gradient background built from existing tokens (`--accent`/`--accent-soft`, theme-safe in both light and dark) plus a decorative, low-opacity inline SVG of overlapping circles absolutely positioned behind the content — fixed positions/opacities/radii (not runtime-random), so server and client render identically and there's no hydration mismatch. All existing content (label, title, context, progress bar, CTA button) renders above the background via z-index, unchanged in substance — this is a wrapper/styling change, not a data or behavior change.

## Assembly changes: `src/app/app/page.tsx`

- Remove the `<h1>Welcome, {displayName}</h1>` block and its subtext paragraph entirely. The page's main content now starts directly with the hero/stat-tile row, matching the reference.
- `previewSlide` derivation: after the existing recommendation-based lookup, if still `null`, call `getFallbackPreviewSlide(supabase, orgId)`.
- Certificates card: render the Recently Earned list (from `getRecentCertificates`) below the existing `CertificateProgressRing`, hidden when the list is empty.
- `QUICK_LINKS` entries gain `icon`/`accentColor`, rendered through `IconBadge`.
- The recommendation hero card's existing markup is restyled per the "Hero card visual redesign" section above; its data and conditional-rendering logic (`recommendation.kind !== "none"`) are unchanged.

No changes to `RecentQuizScores` or the "Modules & Cases" summary card — they weren't flagged as gaps against the reference and stay as-is.

## Error handling

- `getFallbackPreviewSlide` and `getRecentCertificates` follow this codebase's exception-safe wrapper convention: any Supabase error returns `null`/`[]` rather than throwing, so a query failure degrades to "no fallback slide" / "no recently earned list shown," never a broken page.
- `pickNewerCandidate` and `formatCertificateDate` are pure functions with no I/O and no failure modes beyond their typed inputs.

## Testing

- Unit tests: `pickNewerCandidate` (both null, one null each way, both non-null with each ordering) and `formatCertificateDate` (a normal date, exercising any locale/format edge the implementation introduces).
- Live verification against the running dev server and a real demo account (`demo.learner@optymumss.com`):
  - Confirm the WSI viewer card now renders even when the account's own recommendation has no slide (reproducing the exact gap found during triage) — verify it shows the fallback slide's title and a working "Open in Viewer" link.
  - Confirm the duplicate greeting is gone (only `Header`'s greeting remains).
  - Confirm Quick Access tiles show icons, and the Recently Earned list appears for an account with certificates and is absent for one without.
  - Visual check in both light and dark theme against the reference image, screenshotted the same way as the initial triage.
