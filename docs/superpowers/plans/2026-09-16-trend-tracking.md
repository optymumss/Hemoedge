# Historical Trend Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the learner dashboard's 4 existing stat metrics (modules available, case studies available, slides reviewed, certificates earned) real 30-day trend deltas and 30-day daily sparklines, computed from existing timestamped data — no new schema, no cron job, no dashboard UI changes.

**Architecture:** A pure-logic module (`trend-math.ts`) computes deltas and sparkline buckets from plain arrays of `Date`s with no I/O. A Supabase-touching wrapper (`get-dashboard-trends.ts`) fetches the last 60 days of raw timestamps per metric (org-scoped or per-user, matching each metric's existing availability rules) and hands them to the pure module. This mirrors the existing `study-recommendation.ts`/`get-study-recommendation.ts` split already in this codebase.

**Tech Stack:** TypeScript, Vitest (unit tests), Supabase JS client (existing `@/lib/supabase/server` `createClient()`).

## Global Constraints

- No new database tables, columns, or migrations.
- No new npm dependencies.
- No changes to `src/app/app/page.tsx` or any UI component — this plan is backend-logic-only. A later plan (sub-project C) wires this into the dashboard.
- Delta window: current period is `[now - 30 days, now)`, previous period is `[now - 60 days, now - 30 days)`.
- Sparkline: exactly 30 points, oldest first, one per **UTC calendar day**, covering `date(now) - 29 days` through `date(now)` inclusive. Today's (partial) UTC day is bucket 29 (the last point) and accumulates normally.
- `percentChange` is `null` when `previousPeriodCount === 0` — never `Infinity` or `NaN`.
- `direction` is `"up"` when `absoluteChange > 0`, `"down"` when `< 0`, `"flat"` when `0`. No inverted-polarity concept — all 4 metrics treat "up" as positive.
- If any one metric's query fails, that metric alone falls back to a flat/zero trend (`FLAT_TREND` below) — one failing query must never throw or zero out the other three metrics. Because all 4 metrics resolve under one `Promise.all`, each per-metric function must catch its own exceptions internally (not just check the Supabase `{ error }` field) — an uncaught throw in one function rejects the whole `Promise.all` and takes down all 4.
- Org-scoped "available" metrics (modules, cases) must use `org_catalog_selections.created_at` for the "became available" timestamp when `orgId` is set, and `modules.created_at`/`cases.created_at` when it is not — matching `getPublishedContent()`'s existing `status = 'published'` + org-catalog-selection filter exactly, so a trend can never disagree with the headline count it describes.
- Full spec: `docs/superpowers/specs/2026-09-16-trend-tracking-design.md`.

---

### Task 1: Pure trend math

**Files:**
- Create: `src/lib/trends/trend-math.ts`
- Test: `src/lib/trends/trend-math.test.ts`

**Interfaces:**
- Produces: `TrendDelta` type, `Sparkline` type, `computeTrendDelta(currentPeriodCount: number, previousPeriodCount: number): TrendDelta`, `buildSparkline(timestamps: Date[], now: Date): Sparkline` — all consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/trends/trend-math.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeTrendDelta, buildSparkline } from "./trend-math";

describe("computeTrendDelta", () => {
  it("computes a positive delta when the current period is higher", () => {
    const result = computeTrendDelta(10, 5);
    expect(result).toEqual({
      currentPeriodCount: 10,
      previousPeriodCount: 5,
      absoluteChange: 5,
      percentChange: 100,
      direction: "up",
    });
  });

  it("computes a negative delta when the current period is lower", () => {
    const result = computeTrendDelta(5, 10);
    expect(result.absoluteChange).toBe(-5);
    expect(result.percentChange).toBe(-50);
    expect(result.direction).toBe("down");
  });

  it("is flat when both periods are equal and non-zero", () => {
    const result = computeTrendDelta(5, 5);
    expect(result.absoluteChange).toBe(0);
    expect(result.percentChange).toBe(0);
    expect(result.direction).toBe("flat");
  });

  it("returns a null percentChange when the previous period was zero, even with new activity", () => {
    const result = computeTrendDelta(3, 0);
    expect(result.absoluteChange).toBe(3);
    expect(result.percentChange).toBeNull();
    expect(result.direction).toBe("up");
  });

  it("is flat with a null percentChange when both periods are zero", () => {
    const result = computeTrendDelta(0, 0);
    expect(result.absoluteChange).toBe(0);
    expect(result.percentChange).toBeNull();
    expect(result.direction).toBe("flat");
  });
});

describe("buildSparkline", () => {
  const now = new Date(Date.UTC(2026, 8, 16, 12, 0, 0)); // 2026-09-16 12:00 UTC

  it("returns 30 zeroed points when there are no timestamps", () => {
    const result = buildSparkline([], now);
    expect(result.points).toHaveLength(30);
    expect(result.points.every((p) => p === 0)).toBe(true);
  });

  it("buckets a timestamp from today into the last (most recent) point", () => {
    const today = new Date(Date.UTC(2026, 8, 16, 3, 0, 0));
    const result = buildSparkline([today], now);
    expect(result.points[29]).toBe(1);
    expect(result.points.slice(0, 29).every((p) => p === 0)).toBe(true);
  });

  it("buckets a timestamp from 29 days ago into the first (oldest) point", () => {
    const twentyNineDaysAgo = new Date(Date.UTC(2026, 7, 18, 9, 0, 0)); // 2026-08-18
    const result = buildSparkline([twentyNineDaysAgo], now);
    expect(result.points[0]).toBe(1);
    expect(result.points.slice(1).every((p) => p === 0)).toBe(true);
  });

  it("excludes a timestamp from exactly 30 days ago (outside the window)", () => {
    const thirtyDaysAgo = new Date(Date.UTC(2026, 7, 17, 9, 0, 0)); // 2026-08-17
    const result = buildSparkline([thirtyDaysAgo], now);
    expect(result.points.every((p) => p === 0)).toBe(true);
  });

  it("counts multiple timestamps on the same UTC day into one bucket", () => {
    const morning = new Date(Date.UTC(2026, 8, 16, 1, 0, 0));
    const evening = new Date(Date.UTC(2026, 8, 16, 23, 0, 0));
    const result = buildSparkline([morning, evening], now);
    expect(result.points[29]).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/trends/trend-math.test.ts`
Expected: FAIL with "Cannot find module './trend-math'" (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/trends/trend-math.ts`:

```ts
export interface TrendDelta {
  currentPeriodCount: number;
  previousPeriodCount: number;
  absoluteChange: number;
  percentChange: number | null;
  direction: "up" | "down" | "flat";
}

export interface Sparkline {
  points: number[];
}

export function computeTrendDelta(currentPeriodCount: number, previousPeriodCount: number): TrendDelta {
  const absoluteChange = currentPeriodCount - previousPeriodCount;
  const percentChange = previousPeriodCount === 0 ? null : (absoluteChange / previousPeriodCount) * 100;
  const direction: TrendDelta["direction"] = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";

  return { currentPeriodCount, previousPeriodCount, absoluteChange, percentChange, direction };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_DAYS = 30;

function utcDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Buckets timestamps into 30 daily counts, oldest first, by UTC calendar
 * date. `now` is a parameter (not read from the system clock) so this stays
 * deterministic and testable — same pattern as `getGreeting(date, name)`. */
export function buildSparkline(timestamps: Date[], now: Date): Sparkline {
  const points = new Array(SPARKLINE_DAYS).fill(0);
  const today = utcDateOnly(now);

  for (const ts of timestamps) {
    const daysAgo = Math.round((today - utcDateOnly(ts)) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < SPARKLINE_DAYS) {
      points[SPARKLINE_DAYS - 1 - daysAgo] += 1;
    }
  }

  return { points };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/trends/trend-math.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trends/trend-math.ts src/lib/trends/trend-math.test.ts
git commit -m "Add pure trend-delta and sparkline computation logic"
```

---

### Task 2: Dashboard trends data wrapper

**Files:**
- Create: `src/lib/trends/get-dashboard-trends.ts`

**Interfaces:**
- Consumes: `computeTrendDelta`, `buildSparkline`, `TrendDelta`, `Sparkline` from `./trend-math` (Task 1).
- Produces: `DashboardTrends` type and `getDashboardTrends(supabase, userId, orgId, now): Promise<DashboardTrends>` — for sub-project C to consume later.

This task has no unit test file: it's a thin Supabase-query wrapper with no branching logic of its own beyond what Task 1 already covers (see Step 5 for live verification instead, matching how `get-study-recommendation.ts` has no test file in this codebase either).

- [ ] **Step 1: Write the implementation**

Create `src/lib/trends/get-dashboard-trends.ts`:

```ts
import type { createClient } from "@/lib/supabase/server";
import { computeTrendDelta, buildSparkline, type TrendDelta, type Sparkline } from "./trend-math";

export type TrendWithSparkline = TrendDelta & { sparkline: Sparkline };

export interface DashboardTrends {
  modulesAvailable: TrendWithSparkline;
  caseStudiesAvailable: TrendWithSparkline;
  slidesReviewed: TrendWithSparkline;
  certificatesEarned: TrendWithSparkline;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const FLAT_TREND: TrendWithSparkline = {
  currentPeriodCount: 0,
  previousPeriodCount: 0,
  absoluteChange: 0,
  percentChange: null,
  direction: "flat",
  sparkline: { points: new Array(30).fill(0) },
};

function buildTrend(timestamps: Date[], now: Date): TrendWithSparkline {
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  let currentPeriodCount = 0;
  let previousPeriodCount = 0;
  for (const ts of timestamps) {
    if (ts >= thirtyDaysAgo && ts < now) currentPeriodCount++;
    else if (ts >= sixtyDaysAgo && ts < thirtyDaysAgo) previousPeriodCount++;
  }

  return { ...computeTrendDelta(currentPeriodCount, previousPeriodCount), sparkline: buildSparkline(timestamps, now) };
}

/** Shared by modules and cases: matches getPublishedContent()'s own
 * org-catalog-or-global filter exactly, so this trend can never disagree
 * with the headline "available" count it describes. */
async function getContentAvailabilityTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "modules" | "cases",
  contentType: "module" | "case",
  orgId: string | null,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    if (orgId) {
      const { data: selections, error } = await supabase
        .from("org_catalog_selections")
        .select("content_id, created_at")
        .eq("org_id", orgId)
        .eq("content_type", contentType)
        .gte("created_at", sixtyDaysAgoIso);
      if (error) return FLAT_TREND;
      if (!selections || selections.length === 0) return buildTrend([], now);

      const { data: published, error: pubError } = await supabase
        .from(table)
        .select("id")
        .eq("status", "published")
        .in(
          "id",
          selections.map((s) => s.content_id),
        );
      if (pubError) return FLAT_TREND;

      const publishedIds = new Set((published ?? []).map((p) => p.id));
      const timestamps = selections
        .filter((s) => publishedIds.has(s.content_id))
        .map((s) => new Date(s.created_at));
      return buildTrend(timestamps, now);
    }

    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .eq("status", "published")
      .gte("created_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.created_at)), now);
  } catch {
    // A thrown exception (network failure, unexpected client error) must
    // not reject the Promise.all in getDashboardTrends and zero out the
    // other 3 metrics — this metric alone degrades to flat/zero.
    return FLAT_TREND;
  }
}

async function getSlidesReviewedTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase
      .from("slide_views")
      .select("viewed_at")
      .eq("user_id", userId)
      .gte("viewed_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.viewed_at)), now);
  } catch {
    return FLAT_TREND;
  }
}

async function getCertificatesEarnedTrend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase
      .from("certificates")
      .select("issued_at")
      .eq("user_id", userId)
      .gte("issued_at", sixtyDaysAgoIso);
    if (error) return FLAT_TREND;
    return buildTrend((data ?? []).map((r) => new Date(r.issued_at)), now);
  } catch {
    return FLAT_TREND;
  }
}

export async function getDashboardTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
  now: Date,
): Promise<DashboardTrends> {
  const sixtyDaysAgoIso = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  const [modulesAvailable, caseStudiesAvailable, slidesReviewed, certificatesEarned] = await Promise.all([
    getContentAvailabilityTrend(supabase, "modules", "module", orgId, sixtyDaysAgoIso, now),
    getContentAvailabilityTrend(supabase, "cases", "case", orgId, sixtyDaysAgoIso, now),
    getSlidesReviewedTrend(supabase, userId, sixtyDaysAgoIso, now),
    getCertificatesEarnedTrend(supabase, userId, sixtyDaysAgoIso, now),
  ]);

  return { modulesAvailable, caseStudiesAvailable, slidesReviewed, certificatesEarned };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If `supabase.from(table)` where `table: "modules" | "cases"` produces a type error because the generated `Database` type can't narrow a union table name, fall back to two separate near-identical functions (`getModulesAvailableTrend` / `getCaseStudiesAvailableTrend`) instead of the shared `getContentAvailabilityTrend` — correctness and a clean typecheck take priority over the small duplication saved.

- [ ] **Step 3: Live verification against real data (no UI exists yet to check this against)**

Create a temporary, uncommitted script at `/tmp/verify-trends.mjs` (outside the repo, so there's no risk of accidentally committing real credentials). This inlines the same query logic as `get-dashboard-trends.ts` directly in plain JS — it does not import the `.ts` file — so it only needs the already-installed `@supabase/supabase-js` package and plain `node`, with no TypeScript loader involved:

```js
import { createClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const sixtyDaysAgoIso = new Date(now.getTime() - 60 * DAY_MS).toISOString();

function summarize(timestamps) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  let current = 0;
  let previous = 0;
  for (const t of timestamps) {
    const d = new Date(t);
    if (d >= thirtyDaysAgo && d < now) current++;
    else if (d >= sixtyDaysAgo && d < thirtyDaysAgo) previous++;
  }
  return { currentPeriodCount: current, previousPeriodCount: previous, totalInLast60Days: timestamps.length };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: "demo.learner@optymumss.com",
  password: "HemoDemo2026!",
});
if (authError) throw authError;

const userId = auth.user.id;
const { data: membership } = await supabase
  .from("organization_memberships")
  .select("org_id")
  .eq("user_id", userId)
  .limit(1)
  .maybeSingle();
const orgId = membership?.org_id ?? null;
console.log("userId:", userId, "orgId:", orgId);

const { data: selections } = await supabase
  .from("org_catalog_selections")
  .select("content_id, created_at")
  .eq("org_id", orgId)
  .eq("content_type", "module")
  .gte("created_at", sixtyDaysAgoIso);
console.log("modulesAvailable (org-scoped):", summarize((selections ?? []).map((s) => s.created_at)));

const { data: slideViews } = await supabase
  .from("slide_views")
  .select("viewed_at")
  .eq("user_id", userId)
  .gte("viewed_at", sixtyDaysAgoIso);
console.log("slidesReviewed:", summarize((slideViews ?? []).map((r) => r.viewed_at)));

const { data: certs } = await supabase
  .from("certificates")
  .select("issued_at")
  .eq("user_id", userId)
  .gte("issued_at", sixtyDaysAgoIso);
console.log("certificatesEarned:", summarize((certs ?? []).map((r) => r.issued_at)));
```

Run it from the repo root so `@supabase/supabase-js` resolves from `node_modules`, with the env vars from `.env.local` loaded:

```bash
cd /home/user/Hemoedge && node --env-file=.env.local /tmp/verify-trends.mjs
```

This checks the same underlying queries `getContentAvailabilityTrend`/`getSlidesReviewedTrend`/`getCertificatesEarnedTrend` run (confirming RLS allows them and the shape of the returned rows is as expected) without needing to load the TypeScript module directly. It is not a substitute for the `tsc`/lint pass in Step 2, which already confirms `get-dashboard-trends.ts` itself compiles and type-checks correctly.

Confirm the printed output:
- `orgId` is non-null for this demo account (confirms the org-scoped branch is the one being exercised, not the individual/global branch).
- No query threw an error (the script would throw and exit non-zero on any Supabase error, e.g. an unexpected RLS denial).
- The `currentPeriodCount`/`previousPeriodCount`/`totalInLast60Days` numbers are plausible (non-negative integers, `totalInLast60Days >= currentPeriodCount + previousPeriodCount`).

Report the actual console output in this task's report as evidence. Delete `/tmp/verify-trends.mjs` when done — it is a throwaway verification script, not part of the codebase.

**Known gap:** this verifies the org-scoped branch only (no individual/non-org demo credentials are available). The individual-learner branch (`orgId === null`) reuses the exact same query shape already shipped and working in `getPublishedContent()` (`src/lib/learner/published-content.ts`), so this is a low-risk, already-proven code path — not a live-verified one in this task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/trends/get-dashboard-trends.ts
git commit -m "Add Supabase-backed dashboard trends data wrapper"
```
