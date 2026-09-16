# Historical Trend Tracking — Design Spec

## Context

The cofounder's premium dashboard reference reverses an earlier decision to omit trend deltas: the shell-redesign spec (`docs/superpowers/specs/2026-09-16-app-shell-redesign-design.md`) already scoped this out as its own sub-project:

- **A. App-wide shell redesign** — done, merged (PR #53).
- **B. Historical trend tracking** (this spec) — backend schema/logic so "vs last month" deltas and sparklines are real.
- **C. Learner dashboard v2** (separate spec, later) — the actual dashboard page content, including wiring these trends into stat tiles.

This spec covers **B only**. It is backend-logic-only: no UI changes, no changes to `src/app/app/page.tsx`. Sub-project C consumes this later.

## Goals

- Real (not fabricated) trend deltas and sparkline data for the 4 metrics currently on the learner dashboard: modules available, case studies available, slides reviewed, certificates earned.
- Delta window: last 30 days vs. the 30 days before that.
- Sparkline: one point per day for the last 30 days.
- No new database schema, tables, or scheduled jobs — every metric already has a real timestamp to derive trends from.

## Non-goals

- No dashboard UI changes. Sub-project C wires this into actual stat tiles.
- No metrics beyond the 4 listed above — if C's redesigned dashboard needs different tiles, that's handled when C is scoped.
- No inverted-polarity concept (a metric where "down" is the good direction) — none of the 4 current metrics need it.
- No historical backfill beyond what's queryable from existing timestamp columns (there is no gap — see Architecture).

## Architecture

Follows the existing pure-logic/data-wrapper split already used in this codebase (`study-recommendation.ts` + `get-study-recommendation.ts`, `certificate-progress.ts`):

- **`src/lib/trends/trend-math.ts`** — pure functions, zero I/O.
- **`src/lib/trends/get-dashboard-trends.ts`** — the Supabase-touching wrapper.

### Metric timestamp sources

| Metric | Timestamp source | Scope |
|---|---|---|
| Modules available | `org_catalog_selections.created_at` (org learner) or `modules.created_at` (individual learner) | org-scoped or global |
| Case studies available | Same pattern, `cases` table | org-scoped or global |
| Slides reviewed | `slide_views.viewed_at` | per-user |
| Certificates earned | `certificates.issued_at` | per-user |

For org-scoped learners, `org_catalog_selections.created_at` is used instead of the underlying content's `created_at` because it accurately captures "when this org gained access to this content" — the actual "became available to this learner" moment — rather than when the content row was first created (which may have been while still in draft, long before publishing or before this org selected it). This matches the existing `getPublishedContent()` filter exactly (same `status = 'published'` + `org_catalog_selections` join), so the trend delta can never disagree with the headline count it's describing.

### Window boundaries (precise definitions)

To avoid off-by-one ambiguity at implementation time:

- **Current period**: `[now - 30 days, now)`.
- **Previous period**: `[now - 60 days, now - 30 days)`.
- **Sparkline days**: bucketed by **UTC calendar date** (not local time, since this runs server-side with no reliable per-learner timezone — same rationale as leaving the timezone-correctness of `getGreeting`'s clock source as a known, separately-tracked limitation from sub-project A). 30 buckets, oldest first: `date(now) - 29 days` through `date(now)` inclusive. A timestamp's bucket is `floor((now - timestamp) / 1 day)` days back from today's UTC date; today's (partial) UTC day is bucket 0 and accumulates normally, it is not excluded or specially marked.

### Pure math (`trend-math.ts`)

```ts
export interface TrendDelta {
  currentPeriodCount: number;   // events in the last 30 days
  previousPeriodCount: number;  // events in the 30 days before that
  absoluteChange: number;       // currentPeriodCount - previousPeriodCount
  percentChange: number | null; // null when previousPeriodCount is 0
  direction: "up" | "down" | "flat";
}

export interface Sparkline {
  points: number[]; // exactly 30 entries, oldest first, one per calendar day
}

export function computeTrendDelta(
  currentPeriodCount: number,
  previousPeriodCount: number,
): TrendDelta

export function buildSparkline(
  timestamps: Date[], // raw event timestamps, any order; entries outside the last 30 days are ignored
  now: Date,
): Sparkline
```

- `direction` is `"up"` when `absoluteChange > 0`, `"down"` when `< 0`, `"flat"` when `0`. All 4 current metrics treat "up" as the positive direction — no polarity flag.
- `percentChange` is `null` when `previousPeriodCount === 0` (an undefined percentage, e.g. 0 → 3 is "new activity," not "+300%"). The consumer (sub-project C) decides how to render `null` (e.g. a "New" badge). This spec only guarantees the value is never `Infinity` or `NaN`.
- Neither function touches the system clock or a database — `buildSparkline` takes `now` as an explicit parameter, matching the `getGreeting(date, name)` pattern from sub-project A. Fully deterministic and unit-testable with plain `Date` arrays.

### Data wrapper (`get-dashboard-trends.ts`)

```ts
export interface DashboardTrends {
  modulesAvailable: TrendDelta & { sparkline: Sparkline };
  caseStudiesAvailable: TrendDelta & { sparkline: Sparkline };
  slidesReviewed: TrendDelta & { sparkline: Sparkline };
  certificatesEarned: TrendDelta & { sparkline: Sparkline };
}

export async function getDashboardTrends(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null,
  now: Date,
): Promise<DashboardTrends>
```

For each of the 4 metrics: one query fetches raw timestamps for the last 60 days (`gte(60 days before now)`), the result is split into the two 30-day halves to call `computeTrendDelta`, and the same raw timestamps are passed to `buildSparkline`. The 4 queries run in parallel via `Promise.all`, matching the existing `Promise.all` pattern already in `src/app/app/page.tsx`.

**RLS:** all 4 source tables (`slide_views`, `certificates`, `org_catalog_selections`, `modules`/`cases`) already have RLS policies from earlier migrations that permit a learner to read their own rows / published org-catalog content. `getDashboardTrends` runs as the authenticated user through the existing `createClient()` server helper — the same client every other learner query in this codebase uses. No new RLS policies are needed.

**Error handling:** if any one of the 4 queries fails, that metric's trend falls back to a flat/zero result (`{ currentPeriodCount: 0, previousPeriodCount: 0, absoluteChange: 0, percentChange: null, direction: "flat" }` with a 30-zero sparkline) rather than throwing and breaking the whole dashboard load — consistent with the defensive `?? 0` handling already present in `page.tsx` for the existing stat counts. Each metric's query failure is isolated (via `Promise.allSettled` semantics inside the wrapper, or per-query try/catch) so one failing query never zeroes out the other three.

## Testing

- **`trend-math.test.ts`**: full unit coverage on both pure functions — zero-previous-period (`percentChange` is `null`, not `Infinity`), equal periods (`flat`), increase/decrease (`up`/`down`), sparkline bucketing at day boundaries, sparkline with zero events, sparkline with multiple events on the same day, timestamps older than 30 days excluded from the sparkline but not from delta counting logic (they matter for the 30-60 day "previous period" half).
- **`get-dashboard-trends.ts`**: no live Supabase test double in this codebase's existing patterns (`get-study-recommendation.ts` has none either) — verified via live Playwright/manual check against the demo accounts once wired into a temporary test surface, or deferred to sub-project C's live verification once it's actually rendered. This spec's implementation plan will include a minimal manual verification step (e.g., a temporary debug log or test page) since there's no UI to check it against yet.

## Open Items / Follow-ups (not in this spec)

- Sub-project C wires `getDashboardTrends` into actual stat tile UI, decides how `percentChange: null` and `direction: "flat"` render visually.
- If C's redesigned dashboard introduces new metrics beyond these 4, they get added to `DashboardTrends` at that time.
