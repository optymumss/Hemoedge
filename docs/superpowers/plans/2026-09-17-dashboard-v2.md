# Learner Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the learner dashboard (`src/app/app/page.tsx`) to match the cofounder's reference: real trend metrics on 4 stat tiles (Modules Started, Cases Worked, Quiz Pass Rate, Slides Reviewed), a live embedded WSI viewer with Manual Diff Counter, a Continue Learning card with real per-slide progress, CPD-points wording on the certificate panel, and a 3-tile Quick Access row.

**Architecture:** Extends sub-project B's pure trend-math module with a new ratio-based `PassRateTrend` type. Replaces `get-dashboard-trends.ts`'s org-availability metrics with per-user activity metrics (module/case "first worked" timestamps derived from `quiz_attempts` + `slide_views`). Extends `certificate-progress.ts` with CPD-point sums alongside its existing module-count logic. New presentational components (`StatTile`, `WsiViewerCard`) wire into a restructured `page.tsx`.

**Tech Stack:** TypeScript, Vitest, Supabase JS client, existing `WsiViewer`/`OpenSeadragon` component (unchanged).

## Global Constraints

- No new database tables, columns, or migrations — `modules.cpd_points`/`cases.cpd_points` already exist.
- No new npm dependencies.
- Delta window/sparkline semantics inherited unchanged from sub-project B: current period `[now-30d, now)`, previous `[now-60d, now-30d)`, 30 UTC-daily sparkline points oldest-first.
- `getDashboardTrends`'s signature drops the `orgId` parameter — none of the 4 new metrics are org-scoped (all are per-user activity), unlike sub-project B's org-availability metrics. This is an intentional, documented signature change.
- Every new per-metric fetch function must catch its own exceptions internally (same `try/catch` → flat-fallback rule sub-project B's final review established) so one failing metric never breaks the others under the shared `Promise.all`.
- `PassRateTrend`'s `currentPassRate`/`previousPassRate`/`percentagePointChange` are `null` (never `NaN`/`Infinity`) when a period has zero quiz attempts — direction is `"flat"` whenever either side is null, since there's no rate to compare against.
- `WsiViewer` itself is not modified — the embed uses its existing `enableWbcCounter`/`wbcCounterDefaultOpen` props exactly as they exist today. No new "Explore Mode"/"Teaching Mode" tabs.
- `computeSlideProgress`/`computePassRateTrend`/`formatCountTrendLabel`/`formatPassRateTrendLabel` are pure — no I/O, no system clock reads.
- Full spec: `docs/superpowers/specs/2026-09-17-dashboard-v2-design.md`.

---

### Task 1: Pass-rate trend math + slide-progress math (pure logic)

**Files:**
- Modify: `src/lib/trends/trend-math.ts`
- Modify: `src/lib/trends/trend-math.test.ts`
- Create: `src/lib/learner/module-slide-progress.ts`
- Create: `src/lib/learner/module-slide-progress.test.ts`

**Interfaces:**
- Produces: `PassRateTrend` type, `computePassRateTrend(currentPassed, currentTotal, previousPassed, previousTotal): Omit<PassRateTrend, "sparkline">`, `flatPassRateTrend(): PassRateTrend` — consumed by Task 2. `SlideProgress` type, `computeSlideProgress(lessonSlideIds: string[], viewedSlideIds: Set<string>): SlideProgress` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests for `computePassRateTrend`/`flatPassRateTrend`**

Add to the top of `src/lib/trends/trend-math.test.ts`, changing the import line to:
```ts
import { describe, it, expect } from "vitest";
import { computeTrendDelta, buildSparkline, buildTrend, DAY_MS, computePassRateTrend, flatPassRateTrend } from "./trend-math";
```

Append these new `describe` blocks at the end of the file:
```ts
describe("computePassRateTrend", () => {
  it("computes a positive percentage-point change", () => {
    const result = computePassRateTrend(8, 10, 6, 10);
    expect(result.currentPassRate).toBe(80);
    expect(result.previousPassRate).toBe(60);
    expect(result.percentagePointChange).toBe(20);
    expect(result.direction).toBe("up");
  });

  it("computes a negative percentage-point change", () => {
    const result = computePassRateTrend(5, 10, 8, 10);
    expect(result.percentagePointChange).toBe(-30);
    expect(result.direction).toBe("down");
  });

  it("is flat when the pass rate is unchanged", () => {
    const result = computePassRateTrend(7, 10, 7, 10);
    expect(result.percentagePointChange).toBe(0);
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when the current period has zero attempts", () => {
    const result = computePassRateTrend(0, 0, 6, 10);
    expect(result.currentPassRate).toBeNull();
    expect(result.percentagePointChange).toBeNull();
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when the previous period has zero attempts", () => {
    const result = computePassRateTrend(5, 5, 0, 0);
    expect(result.previousPassRate).toBeNull();
    expect(result.percentagePointChange).toBeNull();
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when both periods have zero attempts", () => {
    const result = computePassRateTrend(0, 0, 0, 0);
    expect(result.currentPassRate).toBeNull();
    expect(result.previousPassRate).toBeNull();
    expect(result.direction).toBe("flat");
  });
});

describe("flatPassRateTrend", () => {
  it("returns a fresh, fully null/zero trend on each call", () => {
    const a = flatPassRateTrend();
    const b = flatPassRateTrend();
    expect(a).not.toBe(b);
    expect(a.currentPassRate).toBeNull();
    expect(a.previousPassRate).toBeNull();
    expect(a.percentagePointChange).toBeNull();
    expect(a.direction).toBe("flat");
    expect(a.sparkline.points).toHaveLength(30);
    expect(a.sparkline.points.every((p) => p === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/trends/trend-math.test.ts`
Expected: FAIL — `computePassRateTrend`/`flatPassRateTrend` are not exported yet.

- [ ] **Step 3: Implement `computePassRateTrend`/`flatPassRateTrend`**

Append to the end of `src/lib/trends/trend-math.ts` (after the existing `flatTrend` function — do not modify anything above it):
```ts
export interface PassRateTrend {
  currentPassRate: number | null;
  previousPassRate: number | null;
  percentagePointChange: number | null;
  direction: "up" | "down" | "flat";
  sparkline: Sparkline;
}

/** Pass rate is a ratio, not a count, so it doesn't fit TrendDelta/buildTrend
 * — there's no meaningful "up" direction to infer from a null baseline the
 * way computeTrendDelta infers "up" from a zero-to-N count change, so
 * direction is "flat" whenever either period has zero attempts (no rate to
 * compare against), not just when the change is exactly zero. */
export function computePassRateTrend(
  currentPassed: number,
  currentTotal: number,
  previousPassed: number,
  previousTotal: number,
): Omit<PassRateTrend, "sparkline"> {
  const currentPassRate = currentTotal === 0 ? null : (currentPassed / currentTotal) * 100;
  const previousPassRate = previousTotal === 0 ? null : (previousPassed / previousTotal) * 100;
  const percentagePointChange =
    currentPassRate === null || previousPassRate === null ? null : currentPassRate - previousPassRate;
  const direction: PassRateTrend["direction"] =
    percentagePointChange === null ? "flat" : percentagePointChange > 0 ? "up" : percentagePointChange < 0 ? "down" : "flat";

  return { currentPassRate, previousPassRate, percentagePointChange, direction };
}

export function flatPassRateTrend(): PassRateTrend {
  return {
    currentPassRate: null,
    previousPassRate: null,
    percentagePointChange: null,
    direction: "flat",
    sparkline: { points: new Array<number>(SPARKLINE_DAYS).fill(0) },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/trends/trend-math.test.ts`
Expected: PASS (15 original + 7 new = 22 tests)

- [ ] **Step 5: Write the failing tests for `computeSlideProgress`**

Create `src/lib/learner/module-slide-progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeSlideProgress } from "./module-slide-progress";

describe("computeSlideProgress", () => {
  it("counts how many of the module's slides have been viewed", () => {
    const result = computeSlideProgress(["a", "b", "c", "d", "e", "f"], new Set(["a", "c"]));
    expect(result).toEqual({ completed: 2, total: 6, percent: 33 });
  });

  it("is 100% when every slide has been viewed", () => {
    const result = computeSlideProgress(["a", "b"], new Set(["a", "b"]));
    expect(result).toEqual({ completed: 2, total: 2, percent: 100 });
  });

  it("is 0% when no slides have been viewed", () => {
    const result = computeSlideProgress(["a", "b"], new Set());
    expect(result).toEqual({ completed: 0, total: 2, percent: 0 });
  });

  it("ignores viewed slide ids that aren't part of this module", () => {
    const result = computeSlideProgress(["a", "b"], new Set(["a", "z"]));
    expect(result).toEqual({ completed: 1, total: 2, percent: 50 });
  });

  it("is 0% (not NaN) for a module with no slides", () => {
    const result = computeSlideProgress([], new Set());
    expect(result).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/lib/learner/module-slide-progress.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 7: Implement `computeSlideProgress`**

Create `src/lib/learner/module-slide-progress.ts`:
```ts
export interface SlideProgress {
  completed: number;
  total: number;
  percent: number;
}

/** How far a learner has gotten through a module's slides, for the
 * "Continue Learning" card's progress bar. Pure — the caller resolves
 * which slide_ids belong to the module's lessons and which of those the
 * learner has viewed. */
export function computeSlideProgress(lessonSlideIds: string[], viewedSlideIds: Set<string>): SlideProgress {
  const total = lessonSlideIds.length;
  const completed = lessonSlideIds.filter((id) => viewedSlideIds.has(id)).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/lib/learner/module-slide-progress.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/trends/trend-math.ts src/lib/trends/trend-math.test.ts src/lib/learner/module-slide-progress.ts src/lib/learner/module-slide-progress.test.ts
git commit -m "Add pass-rate trend math and module slide-progress math"
```

---

### Task 2: Dashboard trends data wrapper — new activity-based metrics

**Files:**
- Modify: `src/lib/trends/get-dashboard-trends.ts` (full rewrite)

**Interfaces:**
- Consumes: `buildTrend`, `flatTrend`, `computePassRateTrend`, `flatPassRateTrend`, `buildSparkline`, `DAY_MS`, `TrendWithSparkline`, `PassRateTrend` from `./trend-math` (Task 1 adds the pass-rate pieces; the rest already exist from sub-project B).
- Produces: `DashboardTrends` type (new shape: `modulesStarted`, `casesWorked`, `quizPassRate`, `slidesReviewed`, each an `ActivityMetric`/`PassRateMetric` — see below) and `getDashboardTrends(supabase, userId, now): Promise<DashboardTrends>` — note the signature drops `orgId` — for Task 7 to consume.

**Important design point caught during this plan's own self-review:** the stat tile's headline number (e.g. "Modules Started: 5") must be a genuine all-time total, not `currentPeriodCount + previousPeriodCount` from the 30/60-day trend window. A module started 90 days ago and never touched again would fall outside BOTH windows and silently vanish from that sum — under-counting any learner with more than 60 days of history. So each metric below returns an `allTimeTotal`/`allTimePassRate` (the headline) separately from a `.trend` (the delta + sparkline, still windowed exactly like sub-project B). For `modulesStarted`/`casesWorked`, the all-time total falls out of the same first-activity map the trend already builds (no extra query); for `slidesReviewed`/`quizPassRate`, it's one extra cheap query (an exact head-count, or an unbounded `passed` column fetch), matching the original (pre-this-plan) dashboard's own pattern of separate all-time head-counts.

This task has no dedicated unit test file — matching sub-project B's established precedent for this file (a Supabase-query wrapper with no branching logic of its own beyond what `trend-math.ts` already covers and tests). See Step 3 for live verification instead.

- [ ] **Step 1: Replace the entire file**

Replace all of `src/lib/trends/get-dashboard-trends.ts` with:
```ts
import type { createClient } from "@/lib/supabase/server";
import { buildTrend, flatTrend, computePassRateTrend, flatPassRateTrend, buildSparkline, DAY_MS } from "./trend-math";
import type { TrendWithSparkline, PassRateTrend } from "./trend-math";

export type { TrendWithSparkline, PassRateTrend };

export interface ActivityMetric {
  allTimeTotal: number;
  trend: TrendWithSparkline;
}

export interface PassRateMetric {
  allTimePassRate: number | null;
  trend: PassRateTrend;
}

export interface DashboardTrends {
  modulesStarted: ActivityMetric;
  casesWorked: ActivityMetric;
  quizPassRate: PassRateMetric;
  slidesReviewed: ActivityMetric;
}

/** Defensive bound against PostgREST's default max-rows cap silently
 * truncating a heavy user's raw-row fetch without an error. */
const RAW_ROW_LIMIT = 10000;

/** A module counts as "started" the first time the learner has any
 * activity tied to it — a quiz attempt, or a slide view on one of its
 * lessons' slides. To classify that first-activity timestamp into the
 * current/previous 30-day window correctly, this needs the learner's
 * ALL-TIME first activity per module, not just activity within the last
 * 60 days — a module started 90 days ago and continued yesterday must not
 * be miscounted as newly-started today. So the raw queries below are
 * unbounded by date (only by RAW_ROW_LIMIT), unlike sub-project B's
 * simpler per-event metrics. The distinct-module count (`.size`) IS the
 * all-time headline total, as a free byproduct of building this map — no
 * extra query needed. */
async function getModulesStartedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("module_id, created_at")
      .eq("user_id", userId)
      .not("module_id", "is", null)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (attemptsError) {
      console.error("[trends] modulesStarted (quiz_attempts) query failed", attemptsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data: views, error: viewsError } = await supabase
      .from("slide_views")
      .select("slide_id, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (viewsError) {
      console.error("[trends] modulesStarted (slide_views) query failed", viewsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const slideIds = Array.from(new Set((views ?? []).map((v) => v.slide_id)));
    const lessonsBySlide = new Map<string, string>();
    if (slideIds.length > 0) {
      const { data: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("slide_id, module_id")
        .in("slide_id", slideIds);
      if (lessonsError) {
        console.error("[trends] modulesStarted (lessons) query failed", lessonsError);
        return { allTimeTotal: 0, trend: flatTrend() };
      }
      for (const l of lessons ?? []) {
        if (l.slide_id) lessonsBySlide.set(l.slide_id, l.module_id);
      }
    }

    const firstActivityByModule = new Map<string, Date>();
    const record = (moduleId: string | null | undefined, timestamp: string) => {
      if (!moduleId) return;
      const ts = new Date(timestamp);
      const existing = firstActivityByModule.get(moduleId);
      if (!existing || ts < existing) firstActivityByModule.set(moduleId, ts);
    };

    for (const a of attempts ?? []) record(a.module_id, a.created_at);
    for (const v of views ?? []) record(lessonsBySlide.get(v.slide_id), v.viewed_at);

    return {
      allTimeTotal: firstActivityByModule.size,
      trend: buildTrend(Array.from(firstActivityByModule.values()), now),
    };
  } catch (err) {
    console.error("[trends] modulesStarted threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

/** Same "first activity" pattern as modulesStarted, via quiz_attempts.case_id
 * and slide_views on the case's own slide_id (cases link to a slide
 * directly, no lessons join needed here). */
async function getCasesWorkedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("case_id, created_at")
      .eq("user_id", userId)
      .not("case_id", "is", null)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (attemptsError) {
      console.error("[trends] casesWorked (quiz_attempts) query failed", attemptsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data: views, error: viewsError } = await supabase
      .from("slide_views")
      .select("slide_id, viewed_at")
      .eq("user_id", userId)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (viewsError) {
      console.error("[trends] casesWorked (slide_views) query failed", viewsError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const slideIds = Array.from(new Set((views ?? []).map((v) => v.slide_id)));
    const casesBySlide = new Map<string, string>();
    if (slideIds.length > 0) {
      const { data: cases, error: casesError } = await supabase
        .from("cases")
        .select("id, slide_id")
        .in("slide_id", slideIds);
      if (casesError) {
        console.error("[trends] casesWorked (cases) query failed", casesError);
        return { allTimeTotal: 0, trend: flatTrend() };
      }
      for (const c of cases ?? []) {
        if (c.slide_id) casesBySlide.set(c.slide_id, c.id);
      }
    }

    const firstActivityByCase = new Map<string, Date>();
    const record = (caseId: string | null | undefined, timestamp: string) => {
      if (!caseId) return;
      const ts = new Date(timestamp);
      const existing = firstActivityByCase.get(caseId);
      if (!existing || ts < existing) firstActivityByCase.set(caseId, ts);
    };

    for (const a of attempts ?? []) record(a.case_id, a.created_at);
    for (const v of views ?? []) record(casesBySlide.get(v.slide_id), v.viewed_at);

    return {
      allTimeTotal: firstActivityByCase.size,
      trend: buildTrend(Array.from(firstActivityByCase.values()), now),
    };
  } catch (err) {
    console.error("[trends] casesWorked threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

async function getQuizPassRateMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<PassRateMetric> {
  try {
    const { data: allTime, error: allTimeError } = await supabase
      .from("quiz_attempts")
      .select("passed")
      .eq("user_id", userId)
      .limit(RAW_ROW_LIMIT);
    if (allTimeError) {
      console.error("[trends] quizPassRate (all-time) query failed", allTimeError);
      return { allTimePassRate: null, trend: flatPassRateTrend() };
    }
    const allTimePassRate =
      allTime && allTime.length > 0 ? (allTime.filter((r) => r.passed).length / allTime.length) * 100 : null;

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("passed, created_at")
      .eq("user_id", userId)
      .gte("created_at", sixtyDaysAgoIso)
      .order("created_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] quizPassRate (windowed) query failed", error);
      return { allTimePassRate, trend: flatPassRateTrend() };
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);

    let currentPassed = 0;
    let currentTotal = 0;
    let previousPassed = 0;
    let previousTotal = 0;
    for (const row of data ?? []) {
      const ts = new Date(row.created_at);
      if (ts >= thirtyDaysAgo && ts < now) {
        currentTotal++;
        if (row.passed) currentPassed++;
      } else if (ts >= sixtyDaysAgo && ts < thirtyDaysAgo) {
        previousTotal++;
        if (row.passed) previousPassed++;
      }
    }

    const passedTimestamps = (data ?? []).filter((r) => r.passed).map((r) => new Date(r.created_at));

    return {
      allTimePassRate,
      trend: {
        ...computePassRateTrend(currentPassed, currentTotal, previousPassed, previousTotal),
        sparkline: buildSparkline(passedTimestamps, now),
      },
    };
  } catch (err) {
    console.error("[trends] quizPassRate threw", err);
    return { allTimePassRate: null, trend: flatPassRateTrend() };
  }
}

async function getSlidesReviewedMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sixtyDaysAgoIso: string,
  now: Date,
): Promise<ActivityMetric> {
  try {
    const { count, error: countError } = await supabase
      .from("slide_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) {
      console.error("[trends] slidesReviewed (all-time count) query failed", countError);
      return { allTimeTotal: 0, trend: flatTrend() };
    }

    const { data, error } = await supabase
      .from("slide_views")
      .select("viewed_at")
      .eq("user_id", userId)
      .gte("viewed_at", sixtyDaysAgoIso)
      .order("viewed_at")
      .limit(RAW_ROW_LIMIT);
    if (error) {
      console.error("[trends] slidesReviewed (windowed) query failed", error);
      return { allTimeTotal: count ?? 0, trend: flatTrend() };
    }
    return { allTimeTotal: count ?? 0, trend: buildTrend((data ?? []).map((r) => new Date(r.viewed_at)), now) };
  } catch (err) {
    console.error("[trends] slidesReviewed threw", err);
    return { allTimeTotal: 0, trend: flatTrend() };
  }
}

export async function getDashboardTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  now: Date,
): Promise<DashboardTrends> {
  const sixtyDaysAgoIso = new Date(now.getTime() - 60 * DAY_MS).toISOString();

  const [modulesStarted, casesWorked, quizPassRate, slidesReviewed] = await Promise.all([
    getModulesStartedMetric(supabase, userId, now),
    getCasesWorkedMetric(supabase, userId, now),
    getQuizPassRateMetric(supabase, userId, sixtyDaysAgoIso, now),
    getSlidesReviewedMetric(supabase, userId, sixtyDaysAgoIso, now),
  ]);

  return { modulesStarted, casesWorked, quizPassRate, slidesReviewed };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Live verification against real data**

Create a temporary, uncommitted script at `/tmp/verify-trends-v2.mjs` (plain JS, no TypeScript import, same approach sub-project B used):
```js
import { createClient } from "@supabase/supabase-js";

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
console.log("userId:", userId);

const { data: attempts, error: attemptsError } = await supabase
  .from("quiz_attempts")
  .select("module_id, case_id, passed, created_at")
  .eq("user_id", userId);
if (attemptsError) throw attemptsError;
console.log("quiz_attempts count:", attempts.length, "sample:", attempts.slice(0, 3));

const { data: views, error: viewsError } = await supabase
  .from("slide_views")
  .select("slide_id, viewed_at")
  .eq("user_id", userId);
if (viewsError) throw viewsError;
console.log("slide_views count:", views.length);

const slideIds = [...new Set(views.map((v) => v.slide_id))];
if (slideIds.length > 0) {
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("slide_id, module_id")
    .in("slide_id", slideIds);
  if (lessonsError) throw lessonsError;
  console.log("lessons matched to viewed slides:", lessons.length);

  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("id, slide_id")
    .in("slide_id", slideIds);
  if (casesError) throw casesError;
  console.log("cases matched to viewed slides:", cases.length);
}

const passed = attempts.filter((a) => a.passed).length;
console.log("pass rate (all-time, for sanity):", attempts.length > 0 ? `${Math.round((passed / attempts.length) * 100)}%` : "no attempts");
```

Run it (same module-resolution workaround as sub-project B — copy into `node_modules/.tmp-*` so `@supabase/supabase-js` resolves):
```bash
cp /tmp/verify-trends-v2.mjs /home/user/Hemoedge/node_modules/.tmp-verify-trends-v2.mjs
cd /home/user/Hemoedge && node --env-file=.env.local node_modules/.tmp-verify-trends-v2.mjs
rm /tmp/verify-trends-v2.mjs /home/user/Hemoedge/node_modules/.tmp-verify-trends-v2.mjs
```

Confirm: no errors thrown, `quiz_attempts`/`slide_views` counts are non-negative, the `lessons`/`cases` lookups by slide_id return plausible (not obviously wrong) row counts. This checks the same table/column access `getModulesStartedTrend`/`getCasesWorkedTrend`/`getQuizPassRateTrend` depend on (confirming RLS allows them) without re-deriving the full windowing logic, which Task 1's tests already cover. Report the actual console output in this task's report as evidence, and confirm via `git status` that neither temp file was left behind.

- [ ] **Step 4: Commit**

```bash
git add src/lib/trends/get-dashboard-trends.ts
git commit -m "Replace dashboard trend metrics with modules-started/cases-worked/quiz-pass-rate"
```

---

### Task 3: Certificate progress — CPD points

**Files:**
- Modify: `src/lib/learner/certificate-progress.ts`
- Modify: `src/lib/learner/certificate-progress.test.ts`
- Modify: `src/components/dashboard/certificate-progress-ring.tsx`

**Interfaces:**
- Produces: `CertificateProgress` gains `earnedCpdPoints`/`totalCpdPoints` fields; `CurriculumForProgress`'s `modules` entries gain a `cpdPoints: number` field — consumed by Task 7's page assembly (which already calls `getCertificateProgress`, unchanged call signature).

- [ ] **Step 1: Write the failing/updated tests**

Replace all of `src/lib/learner/certificate-progress.test.ts` with:
```ts
import { describe, expect, it } from "vitest";
import { pickCertificateProgress } from "./certificate-progress";

describe("pickCertificateProgress", () => {
  it("computes percent complete from modules passed vs. total, and sums CPD points", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Anaemia Fundamentals",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 40, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Anaemia Fundamentals",
      percentComplete: 50,
      completedModules: 2,
      totalModules: 4,
      earnedCpdPoints: 10,
      totalCpdPoints: 20,
    });
  });

  it("sums CPD points by weight, not by module count", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Weighted Curriculum",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 10 },
          { bestScore: 40, passThreshold: 70, cpdPoints: 15 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 3 },
        ],
      },
    ]);

    // Only the 1st and 3rd modules pass (10 + 3 = 13 of 28 total) — if this
    // were counting modules instead of summing points it would be 2/3.
    expect(result?.earnedCpdPoints).toBe(13);
    expect(result?.totalCpdPoints).toBe(28);
    expect(result?.completedModules).toBe(2);
    expect(result?.totalModules).toBe(3);
  });

  it("ignores curricula that don't award a certificate", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Practice Track",
        certificateAwarded: false,
        modules: [{ bestScore: 90, passThreshold: 70, cpdPoints: 5 }],
      },
    ]);

    expect(result).toBeNull();
  });

  it("picks the certificate-awarding curriculum closest to completion", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Anaemia Fundamentals",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
      {
        curriculumId: "cur2",
        title: "Hand-to-Hand Basics",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    // cur1 is 50% (1/2), cur2 is 67% (2/3) — cur2 is closer to completion.
    expect(result?.curriculumId).toBe("cur2");
  });

  it("skips a fully completed curriculum in favor of one still in progress", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Already Done",
        certificateAwarded: true,
        modules: [{ bestScore: 90, passThreshold: 70, cpdPoints: 5 }],
      },
      {
        curriculumId: "cur2",
        title: "In Progress",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    expect(result?.curriculumId).toBe("cur2");
  });

  it("falls back to a 0%-complete certificate curriculum when none are in progress", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Not Started Yet",
        certificateAwarded: true,
        modules: [
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Not Started Yet",
      percentComplete: 0,
      completedModules: 0,
      totalModules: 2,
      earnedCpdPoints: 0,
      totalCpdPoints: 10,
    });
  });

  it("returns null when there is no certificate-awarding curriculum at all", () => {
    expect(pickCertificateProgress([])).toBeNull();
  });

  it("returns null for a certificate curriculum with no modules linked yet", () => {
    const result = pickCertificateProgress([
      { curriculumId: "cur1", title: "Empty", certificateAwarded: true, modules: [] },
    ]);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/learner/certificate-progress.test.ts`
Expected: FAIL — `cpdPoints`/`earnedCpdPoints`/`totalCpdPoints` don't exist on the current types/implementation yet (TypeScript errors and/or assertion failures).

- [ ] **Step 3: Update the implementation**

Replace all of `src/lib/learner/certificate-progress.ts` with:
```ts
import { createClient } from "@/lib/supabase/server";

export type CertificateProgress = {
  curriculumId: string;
  title: string;
  percentComplete: number;
  completedModules: number;
  totalModules: number;
  earnedCpdPoints: number;
  totalCpdPoints: number;
};

export type CurriculumForProgress = {
  curriculumId: string;
  title: string;
  certificateAwarded: boolean;
  modules: { bestScore: number | null; passThreshold: number; cpdPoints: number }[];
};

/**
 * Picks which certificate-awarding curriculum to show progress toward on
 * the dashboard: whichever the learner is closest to finishing, so the
 * ring always reflects the certificate nearest in reach. Falls back to an
 * unstarted certificate curriculum (0%) if none are in progress yet, so a
 * brand-new learner still sees what they're working toward.
 *
 * percentComplete/completedModules/totalModules stay module-completion
 * based (unweighted) — earnedCpdPoints/totalCpdPoints are the separate,
 * points-weighted sums the CPD Progress card displays as "N / M CPD
 * points". A curriculum with unevenly-weighted modules will have these two
 * views disagree in ratio, which is expected and correct.
 */
export function pickCertificateProgress(curricula: CurriculumForProgress[]): CertificateProgress | null {
  const scored = curricula
    .filter((c) => c.certificateAwarded && c.modules.length > 0)
    .map((c) => {
      const passed = c.modules.filter((m) => m.bestScore !== null && m.bestScore >= m.passThreshold);
      const completedModules = passed.length;
      const percentComplete = Math.round((completedModules / c.modules.length) * 100);
      const earnedCpdPoints = passed.reduce((sum, m) => sum + m.cpdPoints, 0);
      const totalCpdPoints = c.modules.reduce((sum, m) => sum + m.cpdPoints, 0);
      return {
        curriculumId: c.curriculumId,
        title: c.title,
        percentComplete,
        completedModules,
        totalModules: c.modules.length,
        earnedCpdPoints,
        totalCpdPoints,
      };
    });

  if (scored.length === 0) return null;

  const inProgress = scored.filter((c) => c.percentComplete < 100).sort((a, b) => b.percentComplete - a.percentComplete);
  if (inProgress.length > 0) return inProgress[0];

  return scored[0];
}

export async function getCertificateProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<CertificateProgress | null> {
  let curriculumIds: string[] | null = null;
  if (orgId) {
    const { data: selections } = await supabase
      .from("org_catalog_selections")
      .select("content_id")
      .eq("org_id", orgId)
      .eq("content_type", "curriculum");
    curriculumIds = (selections ?? []).map((s) => s.content_id);
    if (curriculumIds.length === 0) return null;
  }

  const baseQuery = supabase
    .from("curricula")
    .select("id, title, certificate_awarded, pass_threshold")
    .eq("status", "published")
    .eq("certificate_awarded", true)
    .order("title");

  const { data: curricula } = await (curriculumIds ? baseQuery.in("id", curriculumIds) : baseQuery);

  if (!curricula || curricula.length === 0) return null;

  const fetchedCurriculumIds = curricula.map((c) => c.id);
  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id, module_id")
    .in("curriculum_id", fetchedCurriculumIds);

  const moduleIds = Array.from(new Set((links ?? []).map((l) => l.module_id)));
  const { data: attempts } =
    moduleIds.length > 0
      ? await supabase.from("quiz_attempts").select("module_id, score").eq("user_id", userId).in("module_id", moduleIds)
      : { data: [] };

  const bestByModule = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.module_id) continue;
    bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
  }

  const { data: modulesData } =
    moduleIds.length > 0 ? await supabase.from("modules").select("id, cpd_points").in("id", moduleIds) : { data: [] };
  const cpdPointsByModule = new Map<string, number>();
  for (const m of modulesData ?? []) {
    cpdPointsByModule.set(m.id, m.cpd_points ?? 0);
  }

  const input: CurriculumForProgress[] = curricula.map((c) => ({
    curriculumId: c.id,
    title: c.title,
    certificateAwarded: c.certificate_awarded,
    modules: (links ?? [])
      .filter((l) => l.curriculum_id === c.id)
      .map((l) => ({
        bestScore: bestByModule.get(l.module_id) ?? null,
        passThreshold: c.pass_threshold,
        cpdPoints: cpdPointsByModule.get(l.module_id) ?? 0,
      })),
  }));

  return pickCertificateProgress(input);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/learner/certificate-progress.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Update the ring component's labels**

Replace all of `src/components/dashboard/certificate-progress-ring.tsx` with:
```tsx
import type { CertificateProgress } from "@/lib/learner/certificate-progress";

/** A simple SVG ring — no charting library needed for one static value. */
export function CertificateProgressRing({ progress }: { progress: CertificateProgress }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percentComplete / 100);
  const pointsToNext = progress.totalCpdPoints - progress.earnedCpdPoints;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-4">
      <p className="self-start text-xs font-semibold uppercase tracking-wide text-ink-dim">CPD Progress</p>
      <svg width="112" height="112" viewBox="0 0 96 96" className="-rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-semibold text-ink">{progress.percentComplete}%</p>
        <p className="text-xs text-ink-dim">
          {progress.earnedCpdPoints} / {progress.totalCpdPoints} CPD points
        </p>
        {pointsToNext > 0 && <p className="mt-1 text-xs text-ink-faint">{pointsToNext} points to next certificate</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/learner/certificate-progress.ts src/lib/learner/certificate-progress.test.ts src/components/dashboard/certificate-progress-ring.tsx
git commit -m "Add CPD-points weighting to certificate progress, update card wording"
```

---

### Task 4: StatTile presentational component + trend-label formatters

**Files:**
- Create: `src/lib/learner/format-trend-label.ts`
- Create: `src/lib/learner/format-trend-label.test.ts`
- Create: `src/components/dashboard/stat-tile.tsx`
- Create: `src/components/dashboard/stat-icons.tsx`

**Interfaces:**
- Produces: `formatCountTrendLabel(trend: TrendDelta): string`, `formatPassRateTrendLabel(trend: PassRateTrend): string`, `StatTile` component, 4 icon components (`ModuleIcon`, `CaseIcon`, `PassRateIcon`, `SlideIcon`) — all consumed by Task 7's page assembly.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/learner/format-trend-label.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatCountTrendLabel, formatPassRateTrendLabel } from "./format-trend-label";

describe("formatCountTrendLabel", () => {
  it("formats a positive percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 5, previousPeriodCount: 4, absoluteChange: 1, percentChange: 25, direction: "up" }),
    ).toBe("+25% vs last month");
  });

  it("formats a negative percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 3, previousPeriodCount: 6, absoluteChange: -3, percentChange: -50, direction: "down" }),
    ).toBe("-50% vs last month");
  });

  it("rounds a fractional percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 4, previousPeriodCount: 3, absoluteChange: 1, percentChange: 33.333, direction: "up" }),
    ).toBe("+33% vs last month");
  });

  it("shows New when there's new activity but no prior baseline", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 3, previousPeriodCount: 0, absoluteChange: 3, percentChange: null, direction: "up" }),
    ).toBe("New");
  });

  it("shows No change when both periods are zero", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 0, previousPeriodCount: 0, absoluteChange: 0, percentChange: null, direction: "flat" }),
    ).toBe("No change");
  });
});

describe("formatPassRateTrendLabel", () => {
  it("formats a positive percentage-point change", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 80, previousPassRate: 60, percentagePointChange: 20, direction: "up", sparkline: { points: [] } }),
    ).toBe("+20pp vs last month");
  });

  it("formats a negative percentage-point change", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 50, previousPassRate: 80, percentagePointChange: -30, direction: "down", sparkline: { points: [] } }),
    ).toBe("-30pp vs last month");
  });

  it("shows New when there's a current rate but no prior baseline", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 72, previousPassRate: null, percentagePointChange: null, direction: "flat", sparkline: { points: [] } }),
    ).toBe("New");
  });

  it("shows No data when there's no current rate either", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: null, previousPassRate: null, percentagePointChange: null, direction: "flat", sparkline: { points: [] } }),
    ).toBe("No data");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/learner/format-trend-label.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement the formatters**

Create `src/lib/learner/format-trend-label.ts`:
```ts
import type { TrendDelta, PassRateTrend } from "@/lib/trends/trend-math";

/** "+25% vs last month" / "-10% vs last month", or "New" when there's
 * activity now but no prior-period baseline to compare against, or
 * "No change" when both periods are genuinely zero. */
export function formatCountTrendLabel(trend: TrendDelta): string {
  if (trend.percentChange === null) {
    return trend.currentPeriodCount > 0 ? "New" : "No change";
  }
  const rounded = Math.round(trend.percentChange);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs last month`;
}

/** Percentage POINTS, not percent-of-percent — "+12pp" means the pass rate
 * moved 12 points, not that it grew by 12% of its prior value. */
export function formatPassRateTrendLabel(trend: PassRateTrend): string {
  if (trend.percentagePointChange === null) {
    return trend.currentPassRate !== null ? "New" : "No data";
  }
  const rounded = Math.round(trend.percentagePointChange);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}pp vs last month`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/learner/format-trend-label.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Create the stat tile icons**

Create `src/components/dashboard/stat-icons.tsx` (16x16, `stroke="currentColor"` `strokeWidth="1.4"`, matching `nav-icons.tsx`'s existing style):
```tsx
export function ModuleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.8L13 4.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M5.5 7.5h5M5.5 10h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1 1.4h5.4A1.5 1.5 0 0 1 14 5.9v5.6A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PassRateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.7 9.5 5 14l3-1.5 3 1.5-.7-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function SlideIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 14h4M8 11.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 6: Create the StatTile component**

Create `src/components/dashboard/stat-tile.tsx`:
```tsx
import type { Sparkline } from "@/lib/trends/trend-math";

const ACCENT_CLASSES: Record<"red" | "orange" | "green" | "purple", { icon: string; spark: string }> = {
  red: { icon: "bg-danger-soft text-danger-soft-ink", spark: "stroke-danger" },
  orange: { icon: "bg-warning-soft text-warning-soft-ink", spark: "stroke-warning" },
  green: { icon: "bg-success-soft text-success-soft-ink", spark: "stroke-success" },
  purple: { icon: "bg-accent-soft text-accent-soft-ink", spark: "stroke-accent" },
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
  accentColor: "red" | "orange" | "green" | "purple";
}) {
  const classes = ACCENT_CLASSES[accentColor];
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${classes.icon}`} aria-hidden="true">
          {icon}
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className={`text-xs ${DIRECTION_TEXT[direction]}`}>{changeLabel}</p>
      <div className="mt-2">
        <SparklinePath points={sparkline.points} className={classes.spark} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/learner/format-trend-label.ts src/lib/learner/format-trend-label.test.ts src/components/dashboard/stat-tile.tsx src/components/dashboard/stat-icons.tsx
git commit -m "Add StatTile component, trend-label formatters, and stat tile icons"
```

---

### Task 5: Embed the live WSI viewer

**Files:**
- Create: `src/components/dashboard/wsi-viewer-card.tsx`

Note: `src/components/dashboard/wsi-preview-card.tsx` is deleted in Task 7, not here — `page.tsx` still imports and renders it until Task 7's full rewrite, so deleting it in this task would break the build (a real ordering bug caught during this plan's own self-review) until Task 7 lands. The old and new components coexist, unused overlap for one task cycle, which is harmless.

**Interfaces:**
- Consumes: existing `WsiViewer` (`src/components/wsi-viewer.tsx`, unchanged) and `getSlideViewUrl` (`src/lib/slides/get-slide-view-url.ts`, unchanged).
- Produces: `WsiViewerCard` component — consumed by Task 7's page assembly, replacing `WsiPreviewCard`.

- [ ] **Step 1: Create the new card**

Create `src/components/dashboard/wsi-viewer-card.tsx`:
```tsx
import Link from "next/link";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { WsiViewer } from "@/components/wsi-viewer";

/**
 * The dashboard's live, interactive Whole Slide Viewer — not a static
 * preview. Showcasing the WSI learning experience is one of HemoEdge's
 * main differentiators, so this embeds the real viewer (with the Manual
 * Diff Counter) directly, with "Open in Viewer" linking out to the full
 * case/module page for continued work. Replaces the earlier static
 * WsiPreviewCard, whose own docstring predates this decision.
 */
export async function WsiViewerCard({
  slideId,
  slideTitle,
  href,
}: {
  slideId: string;
  slideTitle: string;
  href: string;
}) {
  const { url, dziUrl, error } = await getSlideViewUrl(slideId);
  if (error || !url) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-sunken px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Whole Slide Viewer</p>
          <p className="truncate text-sm text-ink">{slideTitle}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink"
        >
          Open in Viewer &rarr;
        </Link>
      </div>
      <div className="h-[420px]">
        <WsiViewer imageUrl={url} dziUrl={dziUrl} enableWbcCounter wbcCounterDefaultOpen />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean — `WsiViewerCard` is a new, unreferenced-so-far file; nothing else in the codebase changes in this task, so there is nothing to break. (`WsiPreviewCard` stays in place and in use by `page.tsx` until Task 7 — do not touch either in this task.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/wsi-viewer-card.tsx
git commit -m "Add WsiViewerCard: embed the live WSI viewer instead of a static preview"
```

---

### Task 6: Continue Learning card — real per-slide progress

**Files:**
- Modify: `src/app/app/page.tsx` (only the recommendation/preview-slide data-fetching and the Continue Learning card's JSX — the full-page layout restructure is Task 7)

**Interfaces:**
- Consumes: `computeSlideProgress` from `@/lib/learner/module-slide-progress` (Task 1).

This task intentionally makes a narrower, verifiable change before Task 7's full layout rewrite — it swaps the existing "Study Next" section's data-fetching and card markup in place, without touching anything else in the file (the stat tiles grid, imports for `WsiPreviewCard`, etc. all stay as they are here; Task 7 replaces those).

- [ ] **Step 1: Replace the recommendation/preview-slide block**

In `src/app/app/page.tsx`, replace this existing block (currently right after the `quizScores` mapping):
```ts
  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI preview always matches "what to study next."
  let previewSlide: { slideId: string; title: string } | null = null;
  if (recommendation.kind === "module") {
    const { data } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: data.title ?? recommendation.title };
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  }
```
with:
```ts
  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI viewer always matches "what to study next." For a
  // module recommendation, also compute real per-slide progress for the
  // Continue Learning card — fetching all the module's lesson slides (not
  // just the first) both gives us previewSlide and lets us cross-reference
  // slide_views for the progress bar in one pass.
  let previewSlide: { slideId: string; title: string } | null = null;
  let slideProgress: SlideProgress | null = null;
  if (recommendation.kind === "module") {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position");
    const lessonRows = lessons ?? [];
    if (lessonRows.length > 0) {
      const firstSlideId = lessonRows[0].slide_id as string;
      previewSlide = { slideId: firstSlideId, title: lessonRows[0].title ?? recommendation.title };

      const lessonSlideIds = lessonRows.map((l) => l.slide_id as string);
      const { data: views } = await supabase
        .from("slide_views")
        .select("slide_id")
        .eq("user_id", userId!)
        .in("slide_id", lessonSlideIds);
      const viewedSlideIds = new Set((views ?? []).map((v) => v.slide_id));
      slideProgress = computeSlideProgress(lessonSlideIds, viewedSlideIds);
    }
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  }
```

Add the import (near the other `@/lib/learner/...` imports at the top of the file):
```ts
import { computeSlideProgress, type SlideProgress } from "@/lib/learner/module-slide-progress";
```

- [ ] **Step 2: Add the progress bar to the recommendation card's JSX**

In the same file, find the recommendation card block:
```tsx
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
            </p>
            <p className="mt-2 text-lg font-medium text-ink">{recommendation.title}</p>
            {"context" in recommendation && recommendation.context && (
              <p className="mt-1 text-sm text-ink-dim">{recommendation.context}</p>
            )}
            <Link
              href={recommendation.href}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
```
and insert the progress bar between the context paragraph and the `<Link>`:
```tsx
          <div className="rounded-lg border border-line p-4">
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
```
Leave everything else in the file (imports of `WsiPreviewCard`, the stats grid, `certificateProgress`/`recentAttempts` fetching, etc.) exactly as-is — Task 7 replaces the whole file.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. `page.tsx` doesn't call `getDashboardTrends` at all yet (Task 7 introduces that call for the first time), and `getCertificateProgress`'s call signature is unchanged by Task 3 (only its return type gained two new fields page.tsx doesn't reference yet) — so there's nothing left dangling for this task to trip over.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "Show real per-slide progress on the Continue Learning card"
```

---

### Task 7: Assemble the redesigned dashboard page

**Files:**
- Modify: `src/app/app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes everything from Tasks 1-6: `getDashboardTrends` (new signature/shape), `getCertificateProgress` (new fields), `StatTile`, `ModuleIcon`/`CaseIcon`/`PassRateIcon`/`SlideIcon`, `formatCountTrendLabel`/`formatPassRateTrendLabel`, `WsiViewerCard`, `computeSlideProgress`/`SlideProgress` (already wired in Task 6, preserved here).

- [ ] **Step 1: Replace the entire file**

Replace all of `src/app/app/page.tsx` with:
```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";
import { getStudyRecommendation } from "@/lib/learner/get-study-recommendation";
import { getCertificateProgress } from "@/lib/learner/certificate-progress";
import { computeSlideProgress, type SlideProgress } from "@/lib/learner/module-slide-progress";
import { getDashboardTrends } from "@/lib/trends/get-dashboard-trends";
import { formatCountTrendLabel, formatPassRateTrendLabel } from "@/lib/learner/format-trend-label";
import { WsiViewerCard } from "@/components/dashboard/wsi-viewer-card";
import { CertificateProgressRing } from "@/components/dashboard/certificate-progress-ring";
import { RecentQuizScores } from "@/components/dashboard/recent-quiz-scores";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ModuleIcon, CaseIcon, PassRateIcon, SlideIcon } from "@/components/dashboard/stat-icons";

const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content" },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios" },
  { label: "Library", href: "/app/library", blurb: "Browse the slide collection" },
];

export default async function LearnerHome() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const impersonation = await getActiveImpersonation();
  const userId = await getEffectiveUserId();
  const displayName = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile?.fullName || profile?.email;
  const orgId = await getLearnerOrgId();
  const now = new Date();

  const [modules, cases, certificatesResult, recommendation, certificateProgress, dashboardTrends, recentAttempts] =
    await Promise.all([
      getPublishedContent("modules", "module", orgId),
      getPublishedContent("cases", "case", orgId),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      getStudyRecommendation(supabase, userId!, orgId),
      getCertificateProgress(supabase, userId!, orgId),
      getDashboardTrends(supabase, userId!, now),
      supabase
        .from("quiz_attempts")
        .select("id, score, passed, created_at, module_id, case_id, modules(title), cases(title)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const quizScores = (recentAttempts.data ?? []).map((a) => ({
    id: a.id,
    title: a.modules?.title ?? a.cases?.title ?? "Untitled",
    score: a.score,
    passed: a.passed,
  }));

  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI viewer always matches "what to study next." For a
  // module recommendation, also compute real per-slide progress for the
  // Continue Learning card — fetching all the module's lesson slides (not
  // just the first) both gives us previewSlide and lets us cross-reference
  // slide_views for the progress bar in one pass.
  let previewSlide: { slideId: string; title: string } | null = null;
  let slideProgress: SlideProgress | null = null;
  if (recommendation.kind === "module") {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position");
    const lessonRows = lessons ?? [];
    if (lessonRows.length > 0) {
      const firstSlideId = lessonRows[0].slide_id as string;
      previewSlide = { slideId: firstSlideId, title: lessonRows[0].title ?? recommendation.title };

      const lessonSlideIds = lessonRows.map((l) => l.slide_id as string);
      const { data: views } = await supabase
        .from("slide_views")
        .select("slide_id")
        .eq("user_id", userId!)
        .in("slide_id", lessonSlideIds);
      const viewedSlideIds = new Set((views ?? []).map((v) => v.slide_id));
      slideProgress = computeSlideProgress(lessonSlideIds, viewedSlideIds);
    }
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  }

  const statTiles = [
    {
      label: "Modules Started",
      value: String(dashboardTrends.modulesStarted.allTimeTotal),
      icon: <ModuleIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.modulesStarted.trend),
      direction: dashboardTrends.modulesStarted.trend.direction,
      sparkline: dashboardTrends.modulesStarted.trend.sparkline,
      accentColor: "red" as const,
    },
    {
      label: "Cases Worked",
      value: String(dashboardTrends.casesWorked.allTimeTotal),
      icon: <CaseIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.casesWorked.trend),
      direction: dashboardTrends.casesWorked.trend.direction,
      sparkline: dashboardTrends.casesWorked.trend.sparkline,
      accentColor: "orange" as const,
    },
    {
      label: "Quiz Pass Rate",
      value: dashboardTrends.quizPassRate.allTimePassRate === null ? "—" : `${Math.round(dashboardTrends.quizPassRate.allTimePassRate)}%`,
      icon: <PassRateIcon />,
      changeLabel: formatPassRateTrendLabel(dashboardTrends.quizPassRate.trend),
      direction: dashboardTrends.quizPassRate.trend.direction,
      sparkline: dashboardTrends.quizPassRate.trend.sparkline,
      accentColor: "green" as const,
    },
    {
      label: "Slides Reviewed",
      value: String(dashboardTrends.slidesReviewed.allTimeTotal),
      icon: <SlideIcon />,
      changeLabel: formatCountTrendLabel(dashboardTrends.slidesReviewed.trend),
      direction: dashboardTrends.slidesReviewed.trend.direction,
      sparkline: dashboardTrends.slidesReviewed.trend.sparkline,
      accentColor: "purple" as const,
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {orgId ? "Here's what your organization has assigned." : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
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
        <div className={`grid grid-cols-2 gap-3 ${recommendation.kind !== "none" ? "" : "lg:col-span-3"}`}>
          {statTiles.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>
      </div>

      {previewSlide && (
        <div className="mt-6">
          <WsiViewerCard slideId={previewSlide.slideId} slideTitle={previewSlide.title} href={recommendation.href} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RecentQuizScores attempts={quizScores} />
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Modules &amp; Cases</p>
          <p className="mt-2 text-sm text-ink-dim">
            {modules.length} modules and {cases.length} case studies available &middot; {certificatesResult.count ?? 0}{" "}
            certificates earned
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {certificateProgress && (
          <div className="lg:col-span-1">
            <CertificateProgressRing progress={certificateProgress} />
          </div>
        )}
        <div className={certificateProgress ? "lg:col-span-2" : "lg:col-span-3"}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">Quick access</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg border border-line p-4 hover:border-line-strong">
                <p className="font-medium text-ink">{link.label}</p>
                <p className="mt-1 text-sm text-ink-dim">{link.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Note on the "Modules & Cases" block and headline stat values:** the old dashboard's 4 top-level stat cards (Modules available, Case studies available, Slides reviewed, Certificates earned) are now covered differently — `modulesAvailable`/`caseStudiesAvailable`'s org-availability information moved into a small summary line, `slidesReviewed`'s stat-tile headline is `dashboardTrends.slidesReviewed.allTimeTotal` (a genuine all-time count, same semantics as the old dashboard's `slideViewsResult.count`, not a 60-day rolling window — see Task 2's `ActivityMetric` design), and `certificatesEarned`'s count still shows via the existing `certificatesResult` query, folded into the same summary line rather than its own stat tile (per the spec, it's dropped as a stat tile since the reference doesn't have one for it — the number itself is still shown, just not as a trended tile).

- [ ] **Step 2: Delete the now-unused static preview card**

The rewrite above no longer imports or renders `WsiPreviewCard` — delete it now that nothing references it:
```bash
git rm src/components/dashboard/wsi-preview-card.tsx
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean — this is the point where all of Tasks 1-6's dangling references (old `WsiPreviewCard` import, old `getDashboardTrends`/`getCertificateProgress` call shapes) are resolved by this full rewrite, and the deleted file has no remaining importers.

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: PASS, all tests from Tasks 1-4 plus every pre-existing test.

- [ ] **Step 5: Commit**

The `wsi-preview-card.tsx` deletion from Step 2 is already staged — this just adds the rewritten page and commits both together:
```bash
git add src/app/app/page.tsx
git commit -m "Assemble the redesigned learner dashboard page"
```

---

### Task 8: Live verification

No code changes — this task verifies the assembled page against the reference image using the demo learner account (`demo.learner@optymumss.com` / `HemoDemo2026!`).

- [ ] **Step 1: Start the dev server**

```bash
cd /home/user/Hemoedge && npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```
Expected: `200`.

- [ ] **Step 2: Playwright checks**

Using Playwright (same module-resolution approach used in prior sub-projects — copy a `.mjs` script into `node_modules/.tmp-*.mjs` if a standalone script is used, or drive it directly if the harness has native Playwright tooling), log in as the demo learner and confirm:
- The 4 stat tiles render with real (non-placeholder) values, a change label (e.g. "+25% vs last month", "New", or "No change" — not blank or "NaN%"), and a visible sparkline.
- The Continue Learning card shows a progress bar with "N of M slides completed" text when the recommendation is a module (or confirm gracefully there's no progress bar when the demo account's current recommendation isn't a module — check both by inspecting the recommendation returned, not by assuming).
- The Whole Slide Viewer card renders the actual `WsiViewer` (an OpenSeadragon canvas, magnification preset buttons, "Manual Diff Counter" toggle) — not a static `<img>`.
- Clicking a cell category in the Manual Diff Counter panel actually increments its count (confirms it's the live interactive component, not a frozen screenshot-alike).
- "Open in Viewer" links to the expected case/module href.
- The Certificates card shows "CPD Progress" and "N / M CPD points" text (not "Learning & Certificate Progress" / "N / M modules").
- Quick Access shows exactly 3 tiles (Modules, Case Studies, Library) — no Question Bank tile.
- Regression: light/dark theme toggle still works, sidebar stays dark maroon (unaffected by this plan, but confirm nothing broke).
- Mobile viewport: the page doesn't horizontally overflow: the WSI viewer and stat tile grid both need to reflow sanely at ~390px width — note any overflow found rather than silently ignoring it, since this plan's layout code above wasn't given an explicit mobile breakpoint treatment for the stat tile grid or the 420px-tall viewer card.

- [ ] **Step 3: Report and clean up**

Capture screenshots (light/dark, desktop/mobile) as evidence in the task report. Stop the dev server. Delete any temporary verification scripts created for this task.
