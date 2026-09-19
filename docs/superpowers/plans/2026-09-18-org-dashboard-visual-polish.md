# Org Dashboard Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the org admin dashboard (`/org/page.tsx`, shipped in PR #56) toward a richer visual language confirmed via mockup with the user, and add a new hero headline card showing 30-day org-wide activity trend — all using HemoEdge's existing maroon/wine design tokens.

**Architecture:** One new scale-safe Postgres aggregate function feeds a new pure trend-builder and a new wrapper function, following the exact pattern the org-dashboard-v1 plan established. The rest of this plan is presentational: new small pure color-mapping helpers, one new chart component, and a rewrite of `page.tsx`'s JSX — no other data-layer changes.

**Tech Stack:** Next.js App Router (server components), Supabase (Postgres + RLS + RPC), Tailwind v4 (token-driven via `@theme inline` in `globals.css`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-org-dashboard-visual-polish-design.md`

## Global Constraints

- Org size ranges from 2 to 10,000 learners (carried over from the org-dashboard-v1 plan) — the new activity-trend data must be pre-aggregated in Postgres, never fetched as raw event rows into Node.
- No new hardcoded colors. Every visual change references an existing token already defined in `src/app/globals.css` via its Tailwind utility class (`bg-accent`, `border-accent`, `text-accent`, `stroke-accent`, `bg-success-soft`/`text-success-soft-ink`, `bg-danger-soft`/`text-danger-soft-ink`, `bg-warning-soft`/`text-warning-soft-ink`, `bg-info-soft`/`text-info-soft-ink`, `bg-surface-raised`, `bg-surface-sunken`, `bg-ink-faint`) so every element repaints correctly between light and dark themes automatically.
- Accent (`--accent`/`--accent-soft`) means "brand" — trend/status coloring (up/down/severity/score tier) must use the semantic `--success`/`--danger`/`--warning`/`--info` token families instead, per `globals.css`'s own documented separation of accent from status colors.
- No new components that don't fit real org-dashboard data (no world map, no calendar, no CTA tile) — out of scope per the spec.
- Do not modify `/org/analytics`, `/org/reports`, `get-org-progress.ts`, or the four existing RPC functions (`org_dashboard_kpis`, `org_at_risk_learners`, `org_weakest_modules`, `org_onboarding_completion`) from PR #56 — this plan only adds one new RPC function alongside them.

**Demo data for live verification (all tasks that need it):**
- Demo org: `423b604d-9d87-4961-bb8f-864e1cf69b2b` ("Demo Organization").
- Demo org admin login: `demo.orgadmin@optymumss.com` / `HemoDemo2026!` (owner role).
- Demo learner: `demo.learner@optymumss.com` / `HemoDemo2026!` (member role) — used for the authorization negative-test.
- Supabase project id: `uktdipvvnbgzasqlpudl`.

---

### Task 1: Daily activity-count SQL function

**Files:**
- Create: `supabase/migrations/20260919090000_org_daily_activity_counts.sql`
- Modify: `src/lib/supabase/database.types.ts` (append the new function to the `Functions` block)

**Interfaces:**
- Produces: `org_daily_activity_counts(p_org_id uuid)` → 60 rows `{ day_offset: integer, event_count: integer }`, ordered by `day_offset` ascending, where `day_offset` 0 is 59 days ago and `day_offset` 59 is today. Combines `quiz_attempts` and `slide_views` counts per calendar day for the org's members. Gated by `is_org_admin(p_org_id)`, raising `not authorized` if the check fails — same pattern as the four PR #56 functions.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260919090000_org_daily_activity_counts.sql`:

```sql
-- Org dashboard hero card: 60 daily activity counts (quiz_attempts +
-- slide_views combined) for the org's members, computed in Postgres so it
-- scales the same way the rest of the org dashboard's aggregates do (orgs
-- range from 2 to 10,000 learners — fetching raw event timestamps into
-- Node for this would not scale).
create function public.org_daily_activity_counts(p_org_id uuid)
returns table (
  day_offset integer,
  event_count integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized';
  end if;

  return query
  with days as (
    select gs as day_offset, (current_date - (59 - gs)) as day_date
    from generate_series(0, 59) as gs
  ),
  events as (
    select qa.created_at::date as event_date
    from public.quiz_attempts qa
    join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
    where qa.created_at >= now() - interval '60 days'
    union all
    select sv.viewed_at::date as event_date
    from public.slide_views sv
    join public.organization_memberships m on m.user_id = sv.user_id and m.org_id = p_org_id
    where sv.viewed_at >= now() - interval '60 days'
  )
  select d.day_offset, count(e.event_date)::integer as event_count
  from days d
  left join events e on e.event_date = d.day_date
  group by d.day_offset
  order by d.day_offset;
end;
$$;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool `apply_migration` with `project_id: "uktdipvvnbgzasqlpudl"`, `name: "org_daily_activity_counts"`, and `query` set to the SQL from Step 1.

Expected: success, no errors.

- [ ] **Step 3: Regenerate TypeScript types**

Call the Supabase MCP tool `generate_typescript_types` with `project_id: "uktdipvvnbgzasqlpudl"`. The output is large (tens of thousands of characters) — if the tool result is saved to a file rather than returned inline, extract just the `Functions: { ... }` block (find `Functions: {` and match balanced braces to find the end) rather than reading the entire file into context. Replace the existing `Functions: { ... }` block in `src/lib/supabase/database.types.ts` with the regenerated one verbatim. Confirm the new block includes `org_daily_activity_counts` alongside all five functions from PR #56 (`can_manage_content`, `find_profile_id_by_email`, `is_onboarding_assignment_complete`, `is_org_admin`, `is_super_admin`, `org_at_risk_learners`, `org_dashboard_kpis`, `org_onboarding_completion`, `org_weakest_modules`).

- [ ] **Step 4: Verify the function's logic directly via SQL**

The `execute_sql` MCP tool runs with no JWT session context (confirmed during the org-dashboard-v1 plan), so `auth.uid()` is null there and `is_org_admin` will reject every call through it, even for the real demo org — that's expected and doesn't indicate a bug. To verify the underlying logic before the real authorization-respecting test in Task 3, run the function's body as a plain query (no `is_org_admin` gate) via `execute_sql` against org id `423b604d-9d87-4961-bb8f-864e1cf69b2b`:

```sql
with days as (
  select gs as day_offset, (current_date - (59 - gs)) as day_date
  from generate_series(0, 59) as gs
),
events as (
  select qa.created_at::date as event_date
  from quiz_attempts qa
  join organization_memberships m on m.user_id = qa.user_id and m.org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b'
  where qa.created_at >= now() - interval '60 days'
  union all
  select sv.viewed_at::date as event_date
  from slide_views sv
  join organization_memberships m on m.user_id = sv.user_id and m.org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b'
  where sv.viewed_at >= now() - interval '60 days'
)
select d.day_offset, count(e.event_date)::integer as event_count
from days d
left join events e on e.event_date = d.day_date
group by d.day_offset
order by d.day_offset;
```

Expected: exactly 60 rows, `day_offset` running 0 to 59, all `event_count` values non-negative integers. Cross-check: the sum of all 60 `event_count` values should equal the independently-queried total:

```sql
select
  (select count(*) from quiz_attempts qa join organization_memberships m on m.user_id = qa.user_id and m.org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b' where qa.created_at >= now() - interval '60 days')
  +
  (select count(*) from slide_views sv join organization_memberships m on m.user_id = sv.user_id and m.org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b' where sv.viewed_at >= now() - interval '60 days')
  as expected_total;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919090000_org_daily_activity_counts.sql src/lib/supabase/database.types.ts
git commit -m "Add org_daily_activity_counts SQL function for the dashboard hero card"
```

---

### Task 2: Pure logic — trend builder and formatting/color helpers

**Files:**
- Modify: `src/lib/trends/trend-math.ts` (add `buildTrendFromDailyCounts`)
- Test: `src/lib/trends/trend-math.test.ts` (add tests for the new function)
- Modify: `src/lib/org/format-org-dashboard.ts` (add `formatActivityHeadline`, `getReasonBadgeClasses`, `getAtRiskSeverityDotClass`, `getScoreTierBarClass`)
- Test: `src/lib/org/format-org-dashboard.test.ts` (add tests for the four new functions)

**Interfaces:**
- Consumes: `computeTrendDelta`, `TrendWithSparkline`, `TrendDelta` (existing, from `trend-math.ts`); `AtRiskReason` (existing, from `format-org-dashboard.ts`).
- Produces (consumed by Task 3 and Task 5): `buildTrendFromDailyCounts(dailyCounts: number[]): TrendWithSparkline`; `formatActivityHeadline(trend: TrendDelta): string`; `getReasonBadgeClasses(reason: AtRiskReason): string`; `getAtRiskSeverityDotClass(reasons: AtRiskReason[]): string`; `getScoreTierBarClass(score: number): string`.

Note on `buildTrendFromDailyCounts`'s signature: the spec described this taking a `now: Date` parameter to mirror `buildTrend`, but `dailyCounts` is already a positionally-complete array (index 0 = 59 days ago ... index 59 = today per Task 1's contract) — there's no date math left to do, so a `now` parameter would be unused dead weight. This plan drops it; the function takes only `dailyCounts`.

- [ ] **Step 1: Write the failing tests for `buildTrendFromDailyCounts`**

Add to `src/lib/trends/trend-math.test.ts` (alongside the existing `describe` blocks, same file):

```ts
import { buildTrendFromDailyCounts } from "./trend-math";
```

(add this to the existing import line from `"./trend-math"` at the top of the file, alongside the other imported names)

```ts
describe("buildTrendFromDailyCounts", () => {
  it("splits 60 daily counts into previous/current 30-day periods", () => {
    const previous30 = new Array(30).fill(2); // sum 60
    const current30 = new Array(30).fill(3); // sum 90
    const result = buildTrendFromDailyCounts([...previous30, ...current30]);
    expect(result.previousPeriodCount).toBe(60);
    expect(result.currentPeriodCount).toBe(90);
    expect(result.direction).toBe("up");
  });

  it("builds the sparkline from only the current 30-day half, in order", () => {
    const previous30 = new Array(30).fill(0);
    const current30 = Array.from({ length: 30 }, (_, i) => i);
    const result = buildTrendFromDailyCounts([...previous30, ...current30]);
    expect(result.sparkline.points).toEqual(current30);
  });

  it("is flat with a null percentChange when all 60 days are zero", () => {
    const result = buildTrendFromDailyCounts(new Array(60).fill(0));
    expect(result.currentPeriodCount).toBe(0);
    expect(result.previousPeriodCount).toBe(0);
    expect(result.percentChange).toBeNull();
    expect(result.direction).toBe("flat");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- trend-math`
Expected: FAIL — `buildTrendFromDailyCounts is not a function` (or similar import error).

- [ ] **Step 3: Implement `buildTrendFromDailyCounts`**

Add to `src/lib/trends/trend-math.ts`, after `flatTrend()`:

```ts
/** Same TrendWithSparkline shape buildTrend() produces from raw timestamps,
 * but from 60 pre-aggregated daily counts instead — used where the counts
 * must be computed in SQL rather than fetched as raw rows (see the org
 * dashboard's daily-activity RPC). dailyCounts[0] is 59 days ago,
 * dailyCounts[59] is today, ascending — the exact ordering the SQL
 * function that produces this array already returns. */
export function buildTrendFromDailyCounts(dailyCounts: number[]): TrendWithSparkline {
  const previousPeriodCount = dailyCounts.slice(0, 30).reduce((a, b) => a + b, 0);
  const currentPeriodCount = dailyCounts.slice(30, 60).reduce((a, b) => a + b, 0);
  return { ...computeTrendDelta(currentPeriodCount, previousPeriodCount), sparkline: { points: dailyCounts.slice(30, 60) } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- trend-math`
Expected: PASS, all tests in the file (existing + 3 new).

- [ ] **Step 5: Write the failing tests for the format-org-dashboard.ts additions**

Add to `src/lib/org/format-org-dashboard.test.ts` (extend the existing import line to include the four new names):

```ts
import {
  formatAtRiskReasonLabel,
  formatSeatsSummary,
  formatActivityHeadline,
  getReasonBadgeClasses,
  getAtRiskSeverityDotClass,
  getScoreTierBarClass,
} from "./format-org-dashboard";
```

```ts
describe("formatActivityHeadline", () => {
  it("formats a positive percent change", () => {
    expect(formatActivityHeadline({ currentPeriodCount: 61, previousPeriodCount: 50, absoluteChange: 11, percentChange: 22, direction: "up" })).toBe(
      "Your team's engagement is up 22% this month.",
    );
  });

  it("formats a negative percent change using the absolute value", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 40, previousPeriodCount: 50, absoluteChange: -10, percentChange: -20, direction: "down" }),
    ).toBe("Your team's engagement is down 20% this month.");
  });

  it("is flat when the change is exactly zero", () => {
    expect(formatActivityHeadline({ currentPeriodCount: 50, previousPeriodCount: 50, absoluteChange: 0, percentChange: 0, direction: "flat" })).toBe(
      "Your team's engagement is flat this month.",
    );
  });

  it("reports new activity when there's no prior baseline but current activity exists", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 5, previousPeriodCount: 0, absoluteChange: 5, percentChange: null, direction: "up" }),
    ).toBe("Your team has new activity this month.");
  });

  it("reports no activity when both periods are zero", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 0, previousPeriodCount: 0, absoluteChange: 0, percentChange: null, direction: "flat" }),
    ).toBe("Your team hasn't had any activity in the last 30 days.");
  });
});

describe("getReasonBadgeClasses", () => {
  it("maps each reason to its own semantic token pair", () => {
    expect(getReasonBadgeClasses("inactive")).toBe("bg-warning-soft text-warning-soft-ink");
    expect(getReasonBadgeClasses("overdue_onboarding")).toBe("bg-info-soft text-info-soft-ink");
    expect(getReasonBadgeClasses("low_performance")).toBe("bg-danger-soft text-danger-soft-ink");
  });
});

describe("getAtRiskSeverityDotClass", () => {
  it("prioritizes low_performance (danger) over the other reasons", () => {
    expect(getAtRiskSeverityDotClass(["inactive", "overdue_onboarding", "low_performance"])).toBe("bg-danger");
  });

  it("prioritizes overdue_onboarding (info) over inactive alone", () => {
    expect(getAtRiskSeverityDotClass(["inactive", "overdue_onboarding"])).toBe("bg-info");
  });

  it("falls back to warning for inactive alone", () => {
    expect(getAtRiskSeverityDotClass(["inactive"])).toBe("bg-warning");
  });
});

describe("getScoreTierBarClass", () => {
  it("is danger below 70", () => {
    expect(getScoreTierBarClass(69)).toBe("bg-danger");
  });

  it("is warning from 70 up to 89", () => {
    expect(getScoreTierBarClass(70)).toBe("bg-warning");
    expect(getScoreTierBarClass(89)).toBe("bg-warning");
  });

  it("is success at 90 and above", () => {
    expect(getScoreTierBarClass(90)).toBe("bg-success");
    expect(getScoreTierBarClass(100)).toBe("bg-success");
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm run test -- format-org-dashboard`
Expected: FAIL — the four new names aren't exported yet.

- [ ] **Step 7: Implement the format-org-dashboard.ts additions**

Replace the full contents of `src/lib/org/format-org-dashboard.ts`:

```ts
import type { TrendDelta } from "@/lib/trends/trend-math";

export type AtRiskReason = "inactive" | "overdue_onboarding" | "low_performance";

const REASON_LABELS: Record<AtRiskReason, string> = {
  inactive: "Inactive 14+ days",
  overdue_onboarding: "Onboarding overdue",
  low_performance: "Below pass threshold",
};

export function formatAtRiskReasonLabel(reason: AtRiskReason): string {
  return REASON_LABELS[reason];
}

const REASON_BADGE_CLASSES: Record<AtRiskReason, string> = {
  inactive: "bg-warning-soft text-warning-soft-ink",
  overdue_onboarding: "bg-info-soft text-info-soft-ink",
  low_performance: "bg-danger-soft text-danger-soft-ink",
};

export function getReasonBadgeClasses(reason: AtRiskReason): string {
  return REASON_BADGE_CLASSES[reason];
}

/** Highest-severity reason wins: a learner with both an activity problem
 * and a performance problem should show the more urgent color. Every
 * caller today only passes non-empty arrays (org_at_risk_learners never
 * returns a row with zero reasons) — the fallback exists only so this
 * function is total. */
const SEVERITY_PRIORITY: AtRiskReason[] = ["low_performance", "overdue_onboarding", "inactive"];
const SEVERITY_DOT_CLASSES: Record<AtRiskReason, string> = {
  low_performance: "bg-danger",
  overdue_onboarding: "bg-info",
  inactive: "bg-warning",
};

export function getAtRiskSeverityDotClass(reasons: AtRiskReason[]): string {
  for (const reason of SEVERITY_PRIORITY) {
    if (reasons.includes(reason)) return SEVERITY_DOT_CLASSES[reason];
  }
  return "bg-ink-faint";
}

export function getScoreTierBarClass(score: number): string {
  if (score < 70) return "bg-danger";
  if (score < 90) return "bg-warning";
  return "bg-success";
}

export function formatSeatsSummary(seatsUsed: number, seatsTotal: number | null): string {
  return seatsTotal === null ? `${seatsUsed} (unlimited)` : `${seatsUsed} / ${seatsTotal}`;
}

/** The hero card's headline sentence. Distinct from trend-math.ts's
 * formatCountTrendLabel (which produces short badge text like "+25% vs
 * last month") because the hero card needs a full sentence, not a badge. */
export function formatActivityHeadline(trend: TrendDelta): string {
  if (trend.percentChange === null) {
    return trend.currentPeriodCount > 0
      ? "Your team has new activity this month."
      : "Your team hasn't had any activity in the last 30 days.";
  }
  const rounded = Math.round(trend.percentChange);
  if (rounded > 0) return `Your team's engagement is up ${rounded}% this month.`;
  if (rounded < 0) return `Your team's engagement is down ${Math.abs(rounded)}% this month.`;
  return "Your team's engagement is flat this month.";
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test -- format-org-dashboard`
Expected: PASS, all tests in the file (existing + new).

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/trends/trend-math.ts src/lib/trends/trend-math.test.ts src/lib/org/format-org-dashboard.ts src/lib/org/format-org-dashboard.test.ts
git commit -m "Add pure trend-from-daily-counts builder and org-dashboard color/label helpers"
```

---

### Task 3: Data wrapper for the activity trend

**Files:**
- Modify: `src/lib/org/get-org-dashboard.ts` (add `getOrgActivityTrend`)

**Interfaces:**
- Consumes: `org_daily_activity_counts` RPC (Task 1); `buildTrendFromDailyCounts`, `flatTrend`, `TrendWithSparkline` from `trend-math.ts` (Task 2 + pre-existing).
- Produces (consumed by Task 5): `getOrgActivityTrend(supabase: SupabaseClient, orgId: string): Promise<TrendWithSparkline>`.

- [ ] **Step 1: Implement the wrapper**

In `src/lib/org/get-org-dashboard.ts`, add `flatTrend` and `TrendWithSparkline` to the existing `import ... from "@/lib/trends/trend-math"` line (alongside `computePassRateTrend`, `PassRateTrend`) and add `buildTrendFromDailyCounts` to it too, so the import line reads:

```ts
import { computePassRateTrend, buildTrendFromDailyCounts, flatTrend, type PassRateTrend, type TrendWithSparkline } from "@/lib/trends/trend-math";
```

Then add this function at the end of the file:

```ts
export async function getOrgActivityTrend(supabase: SupabaseClient, orgId: string): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase.rpc("org_daily_activity_counts", { p_org_id: orgId });
    if (error || !data) return flatTrend();

    const dailyCounts = [...data].sort((a, b) => a.day_offset - b.day_offset).map((row) => row.event_count);
    return buildTrendFromDailyCounts(dailyCounts);
  } catch {
    return flatTrend();
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If `tsc` doesn't recognize `"org_daily_activity_counts"` as a valid RPC name, Task 1's Step 3 (regenerating `database.types.ts`) didn't complete correctly — fix that before continuing.

- [ ] **Step 3: Live verification against the demo org**

Write a throwaway script, copy it into `node_modules/` (this repo's established pattern so module resolution finds the installed `@supabase/supabase-js`), and run it:

```js
// node_modules/.tmp-verify-activity-trend.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: "demo.orgadmin@optymumss.com",
  password: "HemoDemo2026!",
});
if (authError) throw authError;

const orgId = "423b604d-9d87-4961-bb8f-864e1cf69b2b";

const result = await supabase.rpc("org_daily_activity_counts", { p_org_id: orgId });
console.log("row count:", result.data?.length, "error:", result.error);
const total = (result.data ?? []).reduce((sum, row) => sum + row.event_count, 0);
console.log("total events across 60 days:", total);
console.log("day_offsets present:", (result.data ?? []).map((r) => r.day_offset).sort((a, b) => a - b));

// Authorization check: the demo learner (member, not owner/admin) must be rejected.
await supabase.auth.signOut();
const { error: learnerAuthError } = await supabase.auth.signInWithPassword({
  email: "demo.learner@optymumss.com",
  password: "HemoDemo2026!",
});
if (learnerAuthError) throw learnerAuthError;
const rejected = await supabase.rpc("org_daily_activity_counts", { p_org_id: orgId });
console.log("non-admin call error (expected 'not authorized'):", rejected.error);
```

Run: `cp <script> node_modules/.tmp-verify-activity-trend.mjs && node --env-file=.env.local node_modules/.tmp-verify-activity-trend.mjs`

Expected: `row count: 60`, `error: null`, `day_offsets present` is exactly `[0, 1, ..., 59]` (60 consecutive integers), the total matches what Task 1's Step 4 cross-check found (re-run that SQL query if needed to compare), and the final non-admin call's error is non-null with a message indicating authorization failure. If the non-admin call does NOT error, stop and report BLOCKED — that would mean a learner can read org-wide activity data.

Delete the temp file after: `rm -f node_modules/.tmp-verify-activity-trend.mjs`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/org/get-org-dashboard.ts
git commit -m "Add getOrgActivityTrend wrapper for the org dashboard hero card"
```

---

### Task 4: Activity area-chart component

**Files:**
- Create: `src/components/dashboard/activity-area-chart.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure presentational component, takes `points: number[]` directly).
- Produces (consumed by Task 5): `ActivityAreaChart({ points }: { points: number[] })` component.

- [ ] **Step 1: Implement the component**

Create `src/components/dashboard/activity-area-chart.tsx`:

```tsx
"use client";

import { useId } from "react";

/** The hero card's area chart. Same normalization math as stat-tile.tsx's
 * SparklinePath, scaled up, with an accent-tinted fill under the line. The
 * gradient id is unique per instance (useId) so this component is safe to
 * render more than once on a page without one instance's fill silently
 * reusing another's <linearGradient> definition. */
export function ActivityAreaChart({ points }: { points: number[] }) {
  const gradientId = useId();
  const max = Math.max(...points, 1);
  const width = 600;
  const height = 90;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => [i * step, height - (p / max) * height] as const);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" strokeWidth="2" className="stroke-accent" />
    </svg>
  );
}
```

`"use client"` is required because `useId` needs to run per-render on the client to guarantee stable hydration-matched ids — Server Components can call `useId` too, but marking this a Client Component keeps it consistent with the rest of this app's small interactive/presentational leaf components and avoids any ambiguity about server/client boundaries for a component that's purely rendering, not fetching.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/activity-area-chart.tsx
git commit -m "Add ActivityAreaChart component for the org dashboard hero card"
```

---

### Task 5: Assemble the restyled page

**Files:**
- Modify: `src/app/org/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getOrgActivityTrend` (Task 3); `ActivityAreaChart` (Task 4); `formatActivityHeadline`, `getReasonBadgeClasses`, `getAtRiskSeverityDotClass`, `getScoreTierBarClass`, `formatAtRiskReasonLabel`, `formatSeatsSummary` (Task 2 + pre-existing); everything else unchanged from PR #56 (`getCurrentOrg`, `ComingSoon`, `createClient`, `getOrgDashboardKpis`, `getAtRiskLearners`, `getOrgWeakestModules`, `getOnboardingCompletion`, `formatPassRateTrendLabel`).

Before writing this task's code, two deviations from the spec's exact wording, both deliberate:

1. The Onboarding Completion section's progress bar already uses a solid `bg-accent` fill (`src/app/org/page.tsx` line 162, confirmed by reading the current file) — the spec's requirement that it use a solid accent fill rather than a gradient blend is **already satisfied**. No change to that section is needed beyond what naturally falls out of the rest of this rewrite.
2. The spec says the hero headline should render "with the percentage itself in `--accent`" (i.e. just the number colored, rest of the sentence in the default ink color). `formatActivityHeadline` (Task 2) returns one plain string, not structured segments — splitting out just the number would mean either parsing the returned string back apart in the component (fragile, breaks the moment the sentence wording changes) or changing the function's return type to a list of `{text, accent}` segments (complicates a function whose whole value is being a simple, easily-tested pure string builder). This plan renders the full sentence in one color (`text-ink`) instead. The accent color is still strongly present elsewhere in the hero card — the area chart's line and fill, and the "View Analytics" link — so this simplification doesn't make the card feel accent-less, just slightly less decorated than the mockup. If this reads as a meaningful loss once seen live, it's a small follow-up, not a blocker.

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/org/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import {
  getOrgDashboardKpis,
  getAtRiskLearners,
  getOrgWeakestModules,
  getOnboardingCompletion,
  getOrgActivityTrend,
} from "@/lib/org/get-org-dashboard";
import { formatPassRateTrendLabel } from "@/lib/learner/format-trend-label";
import {
  formatAtRiskReasonLabel,
  formatSeatsSummary,
  formatActivityHeadline,
  getReasonBadgeClasses,
  getAtRiskSeverityDotClass,
  getScoreTierBarClass,
} from "@/lib/org/format-org-dashboard";
import { ActivityAreaChart } from "@/components/dashboard/activity-area-chart";

const PASS_RATE_PILL_CLASSES: Record<"up" | "down" | "flat", string> = {
  up: "bg-success-soft text-success-soft-ink",
  down: "bg-danger-soft text-danger-soft-ink",
  flat: "bg-surface-sunken text-ink-faint",
};

export default async function OrgHome() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const supabase = await createClient();
  const [kpis, atRisk, weakestModules, onboarding, activityTrend] = await Promise.all([
    getOrgDashboardKpis(supabase, org.id),
    getAtRiskLearners(supabase, org.id),
    getOrgWeakestModules(supabase, org.id),
    getOnboardingCompletion(supabase, org.id),
    getOrgActivityTrend(supabase, org.id),
  ]);

  const passRateLabel = formatPassRateTrendLabel({ ...kpis.passRateTrend, sparkline: { points: [] } });
  const passRatePillClass = PASS_RATE_PILL_CLASSES[kpis.passRateTrend.direction];
  const activityHeadline = formatActivityHeadline(activityTrend);

  return (
    <div>
      <h1 className="text-xl font-semibold">{org.name}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Manage your roster, choose what your learners study from the published catalog, and track team progress.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-gradient-to-br from-surface-raised to-accent-soft p-6">
        <p className="text-xs text-ink-dim">Last 30 days vs. previous 30</p>
        <h2 className="mt-1 max-w-xl text-2xl font-semibold text-ink">{activityHeadline}</h2>
        <div className="mt-4">
          <ActivityAreaChart points={activityTrend.sparkline.points} />
        </div>
        <Link href="/org/analytics" className="mt-3 inline-block text-xs font-medium text-accent">
          View Analytics &rarr;
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.learnerCount}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Avg Quiz Pass Rate</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.passRateTrend.currentPassRate === null ? "—" : `${Math.round(kpis.passRateTrend.currentPassRate)}%`}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${passRatePillClass}`}>{passRateLabel}</span>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">CPD Points</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.cpdEarned} / {kpis.cpdAvailable}
          </p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Certificates Issued</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.certificatesIssued}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Seats</p>
          <p className="mt-1 text-2xl font-semibold">{formatSeatsSummary(kpis.seatsUsed, kpis.seatsTotal)}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">At-Risk Learners ({atRisk.total})</h2>
            <Link href="/org/roster" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.top.map((learner) => (
                  <tr key={learner.userId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">
                      <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${getAtRiskSeverityDotClass(learner.reasons)}`} />
                      {learner.name}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {learner.reasons.map((reason) => (
                          <span key={reason} className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${getReasonBadgeClasses(reason)}`}>
                            {formatAtRiskReasonLabel(reason)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {atRisk.top.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-ink-faint">
                      No at-risk learners right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Weakest Modules</h2>
            <Link href="/org/analytics" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Module</th>
                  <th className="px-4 py-2">Attempts</th>
                  <th className="px-4 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {weakestModules.map((m) => (
                  <tr key={m.moduleId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{m.title}</td>
                    <td className="px-4 py-2 text-ink-dim">{m.attemptCount}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
                          <div className={`h-full rounded-full ${getScoreTierBarClass(m.averageScore)}`} style={{ width: `${m.averageScore}%` }} />
                        </div>
                        <span className="text-ink-dim">{m.averageScore}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {weakestModules.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                      No quiz attempts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {onboarding.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Onboarding Completion</h2>
            <Link href="/org/onboarding" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 space-y-3">
            {onboarding.map((plan) => (
              <div key={plan.planId} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="text-ink-dim">
                    {plan.completedCount} / {plan.assignedCount} complete
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${plan.percentComplete}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint, and run the full test suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean, all tests passing (87/87 — the 81 from before this plan plus the 6 new ones from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/app/org/page.tsx
git commit -m "Restyle the org admin dashboard: hero card, KPI accent-edge cards, severity/score coloring"
```

---

### Task 6: Live verification

**Files:** none (verification only — no code changes).

**Interfaces:** none produced. Consumes the fully restyled page from Task 5.

- [ ] **Step 1: Write and run a Playwright verification script**

Start the dev server if it isn't already running, then log in as `demo.orgadmin@optymumss.com` / `HemoDemo2026!` and navigate to `/org`. Check, for **both** light and dark themes (this pass is specifically about visual polish, so both must be verified, not just dark):

1. Desktop (1600×1000): screenshot full page in light theme, then toggle to dark and screenshot again.
2. Confirm the hero card renders with a visible headline sentence and a non-empty area chart (the `<svg>` inside it has a `<path>` with a non-trivial `d` attribute — not a flat line at 0, unless the demo org genuinely has zero activity in the last 60 days, which Task 3's live verification already told you one way or the other).
3. Confirm all 5 KPI cards show a visible left accent border, and the Avg Quiz Pass Rate card's trend text has a colored pill background (not plain text) — the pill's color should match the real current trend direction from Task 3/the KPI data (e.g., if the real data shows a "down" trend, the pill should use the danger token classes, visually a red/warm tone in light mode).
4. Confirm each At-Risk Learners row shows a small colored dot before the name and one or more colored badges (not comma-separated plain text) for its reasons.
5. Confirm each Weakest Modules row shows a small horizontal colored bar next to its score percentage.
6. Mobile viewport (390×844): screenshot full page, confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2` (no horizontal overflow).
7. Click the hero card's "View Analytics" link and confirm it navigates to `/org/analytics` without an error page.

- [ ] **Step 2: Report findings**

Write a short summary covering: what rendered correctly in both themes, any visual issues found (e.g. a token utility class that didn't apply — check computed styles if a color looks wrong, since an incorrect Tailwind class name for a gradient/token utility fails silently rather than erroring), and confirmation that the KPI pill color, severity dot colors, and score-bar colors visually match what the real underlying data says they should be (cross-referencing Task 3's live RPC output and the existing at-risk/weakest-modules data already verified in the org-dashboard-v1 plan).

No commit for this task (verification only, no files changed).
