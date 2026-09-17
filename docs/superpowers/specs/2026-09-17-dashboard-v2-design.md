# Learner Dashboard v2 — Design Spec

## Context

The cofounder sent a premium reference mockup of the learner dashboard as the exact visual target (`docs/superpowers/specs/2026-09-16-app-shell-redesign-design.md` already scoped this as sub-project C, deferred until the reference image arrived). Sub-projects A (app-wide shell redesign) and B (real historical trend tracking) are both done and merged. This spec is C: the dashboard page content itself.

The reference shows: a hero "Continue Learning" card with real per-slide progress, 4 stat tiles with trend deltas and sparklines, a fully embedded live Whole Slide Viewer with the Manual Diff Counter, Recent Quiz Scores, a "Study Next" recommendation card, a Certificates/CPD Progress panel, and a Quick Access grid.

## Goals

- Rebuild `src/app/app/page.tsx` to match the reference's layout, component set, and visual polish.
- Real trend deltas/sparklines on all 4 stat tiles, using metrics that actually match the reference (not sub-project B's original 4, which were scoped against the old dashboard).
- The dashboard shows the **live, interactive** `WsiViewer` (with Manual Diff Counter) directly — not a static preview image. This reverses `WsiPreviewCard`'s original design intent (its own docstring says "deliberately not the live WsiViewer"), per the cofounder's explicit clarification earlier in this engagement.
- The "Continue Learning" card shows real per-slide progress (e.g. "2 of 6 slides completed", a percentage bar) when recommending a module.
- Certificate panel uses "CPD Progress" / "N / M CPD points" wording, matching both the reference and the app's existing `cpd_points` schema fields on `modules`/`cases`.

## Non-goals

- Org dashboard — separate sub-project, still blocked on the cofounder's own reference image for it.
- Real (functional) search or notifications — stays a placeholder per the shell-redesign spec; the reference's notification badge is a static "3", not wired to real unread-count data.
- New "Explore Mode"/"Teaching Mode" viewer tabs — the reference shows these, but `WsiViewer` doesn't support them today and building that interaction mode is out of scope here. The dashboard embed uses `WsiViewer` exactly as it exists (magnification presets, zoom/rotate/fullscreen/save, Manual Diff Counter toggle).
- A "Question Bank" feature — doesn't exist in the app today (no route, no page, confirmed absent from `src/lib/nav.ts`). The reference's Quick Access tile for it is omitted; Quick Access becomes a 3-tile row (Modules, Cases, Library).
- Any change to sub-project B's `trend-math.ts` pure functions — they're reused as-is, only the queries feeding them change.

## Architecture

### New/changed metrics (`src/lib/trends/get-dashboard-trends.ts`)

The reference's 4 stat tiles are **Modules Started**, **Cases Worked**, **Quiz Pass Rate**, **Slides Reviewed** — not sub-project B's original **Modules/Case Studies Available**, **Slides Reviewed**, **Certificates Earned** (B was scoped against the old dashboard, before this reference existed). Since nothing consumes `DashboardTrends` yet (confirmed dead-but-ready code from B's final review), this is a safe, clean replacement rather than an additive change:

- **`modulesStarted`** replaces `modulesAvailable`: count of *distinct modules* the learner has any activity on (a `slide_views` row via one of the module's `lessons.slide_id`s, or a `quiz_attempts.module_id` row), bucketed into the current/previous 30-day windows by first-activity timestamp. Reuses `buildTrend` unchanged from `trend-math.ts` — only the query supplying its timestamps changes.
- **`casesWorked`** replaces `caseStudiesAvailable`: same pattern, via `quiz_attempts.case_id` and the case's slide's `slide_views`.
- **`slidesReviewed`** stays exactly as sub-project B built it (`slide_views.viewed_at`, per-user).
- **`certificatesEarned` is dropped** — the reference doesn't have this as a stat tile (certificates get their own dedicated panel instead, see below).
- **`quizPassRate` is new** and does not fit `TrendWithSparkline` (a ratio, not a count):
  ```ts
  export interface PassRateTrend {
    currentPassRate: number | null;       // null when 0 attempts in the current 30-day window
    previousPassRate: number | null;      // null when 0 attempts in the previous 30-day window
    percentagePointChange: number | null; // currentPassRate - previousPassRate, in points; null if either input is null
    direction: "up" | "down" | "flat";
    sparkline: Sparkline;                 // daily count of PASSED attempts (activity-shaped, matching the other 3 tiles) — not a daily rate
  }
  ```
  `currentPassRate`/`previousPassRate` are computed from `quiz_attempts.passed`/`created_at` for the user (passed-count ÷ total-count within each 30-day window). `null` rather than fabricating "0%" when a window has zero attempts — same non-fabrication principle sub-project B established for `percentChange`.

### Per-module slide progress (`src/lib/learner/module-slide-progress.ts`, new)

```ts
export function computeSlideProgress(
  lessonSlideIds: string[],   // all slide_ids belonging to the module's lessons, in order
  viewedSlideIds: Set<string>, // slide_ids the learner has a slide_views row for
): { completed: number; total: number; percent: number }
```
Pure function — the data wrapper (in `page.tsx` or a small new helper) fetches `lessons.slide_id` for the recommended module and cross-references `slide_views`. Only computed when `recommendation.kind === "module"`; for `"case"`/`"exercise"` recommendations the Continue Learning card falls back to today's simpler treatment (title + context + button, no progress bar) — the reference only shows the module case, so there's nothing to match pixel-for-pixel for the other two kinds.

### WSI viewer embed

`WsiPreviewCard` (the static `<img>` preview) is replaced by the real `WsiViewer` component, using its existing `enableWbcCounter` prop:
```tsx
<WsiViewer imageUrl={...} dziUrl={...} enableWbcCounter />
```
`wbcCounterDefaultOpen` is left `false` — the reference shows the counter panel visible but at 0/100, matching the toggle already being on by default in this card's context rather than requiring an extra click, so it will be set to `true` specifically for this dashboard card's usage (distinct from the case/module page's default). Wrapped in a card with a header (viewer title, slide subtitle, magnification badge, "Open in Viewer →" link to the same href the current recommendation logic already computes).

### Presentational component: `src/components/dashboard/stat-tile.tsx` (new)

```tsx
export function StatTile({
  label, value, icon, trend, accentColor,
}: {
  label: string;
  value: string;   // pre-formatted by the caller ("5", "72%") — this component doesn't distinguish counts from percentages
  icon: ReactNode;
  trend: { changeLabel: string; direction: "up" | "down" | "flat"; sparkline: Sparkline };
  accentColor: "red" | "orange" | "green" | "purple";
})
```
`changeLabel` (e.g. `"+25% vs last month"`, `"+12pp vs last month"`, `"New"`) is formatted by the page/wrapper before reaching this component, so `StatTile` stays a simple, testable presentational unit with no knowledge of count-delta vs. pass-rate-delta formatting rules. Sparkline rendering (small inline SVG) follows the dataviz skill's guidance for color/accessibility at implementation time.

`accentColor` mapping, matching the reference's per-tile coloring: `modulesStarted` → `"red"`, `casesWorked` → `"orange"`, `quizPassRate` → `"green"`, `slidesReviewed` → `"purple"`.

### Page assembly (`src/app/app/page.tsx`)

Restructured to match the reference's layout: 4 stat tiles across the top beside the Continue Learning card (not below it, as today), then the full-width WSI viewer card, then Recent Quiz Scores + Study Next side by side, then a right column with the Certificates/CPD panel and the (3-tile) Quick Access grid.

### Certificate panel (`certificate-progress-ring.tsx`)

Label text changes from "Learning & Certificate Progress" to "CPD Progress". The `CertificateProgress` type (`src/lib/learner/certificate-progress.ts`) gains two new fields alongside the existing `completedModules`/`totalModules` (which stay as-is, since `percentComplete` is still module-completion-based, not points-based):
```ts
export type CertificateProgress = {
  curriculumId: string;
  title: string;
  percentComplete: number;
  completedModules: number;
  totalModules: number;
  earnedCpdPoints: number;   // sum of cpd_points across modules where bestScore >= passThreshold
  totalCpdPoints: number;    // sum of cpd_points across all modules in the curriculum
};
```
`pickCertificateProgress` computes both sums using the same `bestScore >= passThreshold` completion check it already applies for `completedModules`, just summing `cpd_points` instead of counting modules. The card displays "{earnedCpdPoints} / {totalCpdPoints} CPD points" in place of "{completedModules} / {totalModules} modules", and "{totalCpdPoints - earnedCpdPoints} points to next certificate" per the reference. The ring itself still animates off `percentComplete` (module-completion-based) — the reference's ring percentage and points count aren't necessarily the same number in a real curriculum with unevenly-weighted modules, and this spec keeps the ring's existing, already-correct semantics rather than switching it to a points-based percentage.

## Testing

- `computeSlideProgress` and the stat-tile `changeLabel` formatter: unit tested, pure functions, same pattern as `trend-math.ts`.
- New metric queries (`modulesStarted`, `casesWorked`, `quizPassRate`): live-verified against the demo learner account, matching sub-project B's approach (no dedicated test file for the Supabase-touching wrapper, consistent with this codebase's existing convention).
- Full page assembly: live Playwright verification once built — visual comparison against the reference image, light + dark theme, mobile, and a regression check that the embedded `WsiViewer`'s Manual Diff Counter actually counts clicks (not just renders).

## Open Items / Follow-ups (not in this spec)

- Org dashboard — separate spec, blocked on its own reference image.
- If a future request restores "Certificates Earned" as its own trended stat tile, it can be added back to `DashboardTrends` independently of this spec's changes.
