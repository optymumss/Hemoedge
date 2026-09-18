# Org Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in `/org/page.tsx` (currently a bare title) with a real org-admin dashboard: a KPI strip, an at-risk-learners list, a weakest-modules list, and an onboarding-completion rollup — all backed by new scale-safe Postgres aggregate functions.

**Architecture:** Four new `SECURITY DEFINER` Postgres functions do the counting/averaging/summing server-side (gated by the existing `is_org_admin(org_id)` helper), called from a new `src/lib/org/get-org-dashboard.ts` via `supabase.rpc(...)`. A small pure-TS module formats display labels. `src/app/org/page.tsx` assembles it all using the existing plain-bordered-card visual style already shipped on `/org/reports` and `/org/analytics`.

**Tech Stack:** Next.js App Router (server components), Supabase (Postgres + RLS + RPC), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-org-dashboard-design.md`

## Global Constraints

- Org size ranges from 2 to 10,000 learners. Every new query must scale with Postgres-side aggregation (`GROUP BY`, `count`/`avg`/`sum`), never by fetching full row sets into Node and looping in JavaScript.
- CPD points are HemoEdge-internal only. No external/regulatory CPD target exists or is configurable yet — org-wide "available" CPD is derived purely from the org's own catalog-selected content, never a hardcoded number like "50/year".
- Do not modify `src/lib/org/get-org-progress.ts`, `src/app/org/analytics/page.tsx`, or `src/app/org/reports/page.tsx` — they are out of scope and must keep working unchanged.
- At-risk conditions (any one triggers the flag): (a) no `quiz_attempts` or `slide_views` in the last 14 days, and the member joined more than 14 days ago; (b) an `onboarding_assignments` row with `due_date` in the past that isn't fully complete; (c) average `quiz_attempts.score` below 70 across ≥3 total attempts, OR ≥2 failed attempts (`passed = false`) on the same `module_id` or `case_id`.
- Visual style matches the existing plain-bordered-card/table look already shipped on `/org/reports` and `/org/analytics` — not the colorful `StatTile`/sparkline treatment built for the learner dashboard (no cofounder reference exists for this page).
- New Postgres functions must check `is_org_admin(p_org_id)` themselves and raise an exception if false — they are `SECURITY DEFINER` and bypass RLS, so authorization has to happen inside the function body.

**Demo data for live verification (all tasks that need it):**
- Demo org: `423b604d-9d87-4961-bb8f-864e1cf69b2b` ("Demo Organization"), `seats: null` (unlimited).
- Demo org admin login: `demo.orgadmin@optymumss.com` / `HemoDemo2026!` (owner role).
- Demo learner in that org: `demo.learner@optymumss.com` / `HemoDemo2026!` (member role, user id `2bc86acb-5d7a-49fc-9c45-9f7afd28c415`).
- Supabase project id: `uktdipvvnbgzasqlpudl`.

---

### Task 1: Org dashboard aggregate SQL functions

**Files:**
- Create: `supabase/migrations/20260918090000_org_dashboard_aggregates.sql`
- Modify: `src/lib/supabase/database.types.ts` (append the four new function signatures to the `Functions` block)

**Interfaces:**
- Produces: four Postgres RPC functions callable via `supabase.rpc(name, args)`:
  - `org_dashboard_kpis(p_org_id uuid)` → single row `{ learner_count, seats_used, seats_total, attempts_current, passed_current, attempts_previous, passed_previous, cpd_earned, cpd_available, certificates_issued }` (all `integer`, `seats_total` nullable)
  - `org_at_risk_learners(p_org_id uuid)` → rows `{ user_id uuid, name text, email text, last_activity_at timestamptz | null, reasons text[] }` (one row per at-risk member, `reasons` contains any of `'inactive' | 'overdue_onboarding' | 'low_performance'`)
  - `org_weakest_modules(p_org_id uuid, p_limit integer)` → rows `{ module_id uuid, title text, attempt_count integer, average_score numeric }`
  - `org_onboarding_completion(p_org_id uuid)` → rows `{ plan_id uuid, name text, assigned_count integer, completed_count integer }`
- An internal (non-client-callable) helper `is_onboarding_assignment_complete(p_assignment_id uuid) returns boolean` is used by two of the above but revoked from `public`/`authenticated`/`anon` — later tasks never call it directly.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260918090000_org_dashboard_aggregates.sql`:

```sql
-- Org admin dashboard: scale-safe aggregate functions. Orgs range from 2 to
-- 10,000 learners, so these compute counts/averages/sums in Postgres and
-- return only the small final result — never fetch-all-then-aggregate-in-JS
-- (the pattern get-org-progress.ts uses, which doesn't scale to 10k
-- learners' worth of quiz_attempts rows).

create index if not exists idx_quiz_attempts_created_at on public.quiz_attempts (created_at);

-- Internal helper: is every item in this onboarding assignment's plan
-- complete for the assigned user? A module item is complete if the user has
-- any passed attempt for that module; a curriculum item is complete if the
-- user has a passed attempt for every module in that curriculum. Not
-- exposed to clients directly (see revoke below) — only called from the
-- two SECURITY DEFINER functions below, which already authorize the caller.
create function public.is_onboarding_assignment_complete(p_assignment_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1
    from public.onboarding_assignments oa
    join public.onboarding_plan_items opi on opi.plan_id = oa.plan_id
    where oa.id = p_assignment_id
      and (
        (opi.module_id is not null and not exists (
          select 1 from public.quiz_attempts qa
          where qa.user_id = oa.user_id and qa.module_id = opi.module_id and qa.passed
        ))
        or
        (opi.curriculum_id is not null and exists (
          select 1 from public.curriculum_modules cm
          where cm.curriculum_id = opi.curriculum_id
            and not exists (
              select 1 from public.quiz_attempts qa
              where qa.user_id = oa.user_id and qa.module_id = cm.module_id and qa.passed
            )
        ))
      )
  );
$$;

revoke all on function public.is_onboarding_assignment_complete(uuid) from public;

-- KPI strip: learner count, seat usage, org-wide quiz pass-rate (current vs.
-- previous 30-day window, raw counts so the caller can reuse the existing
-- pure computePassRateTrend()), CPD earned/available, certificates issued.
create function public.org_dashboard_kpis(p_org_id uuid)
returns table (
  learner_count integer,
  seats_used integer,
  seats_total integer,
  attempts_current integer,
  passed_current integer,
  attempts_previous integer,
  passed_previous integer,
  cpd_earned integer,
  cpd_available integer,
  certificates_issued integer
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_module_ids uuid[];
  v_learner_count integer;
  v_points_per_learner integer;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized';
  end if;

  select coalesce(array_agg(distinct cm.module_id), '{}')
  into v_module_ids
  from public.curriculum_modules cm
  join public.curricula c on c.id = cm.curriculum_id
  where c.status = 'published'
    and c.certificate_awarded = true
    and c.id in (
      select ocs.content_id from public.org_catalog_selections ocs
      where ocs.org_id = p_org_id and ocs.content_type = 'curriculum'
    );

  select count(*) into v_learner_count
  from public.organization_memberships m
  where m.org_id = p_org_id;

  select coalesce(sum(mod.cpd_points), 0) into v_points_per_learner
  from public.modules mod
  where mod.id = any(v_module_ids);

  return query
  select
    v_learner_count as learner_count,
    v_learner_count as seats_used,
    (select o.seats from public.organizations o where o.id = p_org_id) as seats_total,
    (select count(*)::integer from public.quiz_attempts qa
       join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
       where qa.created_at >= now() - interval '30 days') as attempts_current,
    (select count(*)::integer from public.quiz_attempts qa
       join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
       where qa.created_at >= now() - interval '30 days' and qa.passed) as passed_current,
    (select count(*)::integer from public.quiz_attempts qa
       join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
       where qa.created_at >= now() - interval '60 days' and qa.created_at < now() - interval '30 days') as attempts_previous,
    (select count(*)::integer from public.quiz_attempts qa
       join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
       where qa.created_at >= now() - interval '60 days' and qa.created_at < now() - interval '30 days' and qa.passed) as passed_previous,
    (select coalesce(sum(mod.cpd_points), 0)::integer
       from (
         select distinct qa.user_id, qa.module_id
         from public.quiz_attempts qa
         join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
         where qa.passed and qa.module_id = any(v_module_ids)
       ) passed_pairs
       join public.modules mod on mod.id = passed_pairs.module_id
    ) as cpd_earned,
    (v_learner_count * v_points_per_learner)::integer as cpd_available,
    (select count(*)::integer from public.certificates cert
       join public.organization_memberships m on m.user_id = cert.user_id and m.org_id = p_org_id) as certificates_issued;
end;
$$;

-- At-risk learners: every member matching any of the three conditions in
-- this plan's Global Constraints. Bounded by org size (at most one row per
-- member — at most 10,000 rows even at max org size), so it's safe to
-- return every match and let the caller slice a "top 5" for display.
create function public.org_at_risk_learners(p_org_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  last_activity_at timestamptz,
  reasons text[]
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
  with members as (
    select m.user_id, m.created_at as joined_at, p.full_name, p.email
    from public.organization_memberships m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org_id
  ),
  last_activity as (
    select mem.user_id,
      greatest(
        (select max(qa.created_at) from public.quiz_attempts qa where qa.user_id = mem.user_id),
        (select max(sv.viewed_at) from public.slide_views sv where sv.user_id = mem.user_id)
      ) as last_activity_at
    from members mem
  ),
  inactive as (
    select mem.user_id
    from members mem
    join last_activity la on la.user_id = mem.user_id
    where mem.joined_at < now() - interval '14 days'
      and (la.last_activity_at is null or la.last_activity_at < now() - interval '14 days')
  ),
  overdue as (
    select distinct oa.user_id
    from public.onboarding_assignments oa
    join public.onboarding_plans op on op.id = oa.plan_id and op.org_id = p_org_id
    where oa.due_date is not null
      and oa.due_date < current_date
      and not public.is_onboarding_assignment_complete(oa.id)
  ),
  low_performance as (
    select mem.user_id
    from members mem
    where (
      (select count(*) from public.quiz_attempts qa where qa.user_id = mem.user_id) >= 3
      and (select avg(qa.score) from public.quiz_attempts qa where qa.user_id = mem.user_id) < 70
    )
    or exists (
      select 1 from public.quiz_attempts qa
      where qa.user_id = mem.user_id and qa.module_id is not null and not qa.passed
      group by qa.module_id
      having count(*) >= 2
    )
    or exists (
      select 1 from public.quiz_attempts qa
      where qa.user_id = mem.user_id and qa.case_id is not null and not qa.passed
      group by qa.case_id
      having count(*) >= 2
    )
  )
  select
    mem.user_id,
    coalesce(mem.full_name, mem.email) as name,
    mem.email,
    la.last_activity_at,
    array_remove(array[
      case when inactive.user_id is not null then 'inactive' end,
      case when overdue.user_id is not null then 'overdue_onboarding' end,
      case when low_performance.user_id is not null then 'low_performance' end
    ], null) as reasons
  from members mem
  join last_activity la on la.user_id = mem.user_id
  left join inactive on inactive.user_id = mem.user_id
  left join overdue on overdue.user_id = mem.user_id
  left join low_performance on low_performance.user_id = mem.user_id
  where inactive.user_id is not null or overdue.user_id is not null or low_performance.user_id is not null
  order by la.last_activity_at asc nulls first;
end;
$$;

-- Weakest modules org-wide, same shape as get-org-progress.ts's existing
-- ModuleProgress but computed with GROUP BY + LIMIT in SQL instead of
-- fetched-then-sorted in JS.
create function public.org_weakest_modules(p_org_id uuid, p_limit integer default 5)
returns table (
  module_id uuid,
  title text,
  attempt_count integer,
  average_score numeric
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
  select
    qa.module_id,
    mod.title,
    count(*)::integer as attempt_count,
    round(avg(qa.score)) as average_score
  from public.quiz_attempts qa
  join public.organization_memberships m on m.user_id = qa.user_id and m.org_id = p_org_id
  join public.modules mod on mod.id = qa.module_id
  where qa.module_id is not null
  group by qa.module_id, mod.title
  order by average_score asc
  limit p_limit;
end;
$$;

-- Onboarding completion per plan. "Active plan" = has at least one
-- assignment (onboarding_plans has no archived/status column today).
create function public.org_onboarding_completion(p_org_id uuid)
returns table (
  plan_id uuid,
  name text,
  assigned_count integer,
  completed_count integer
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
  select
    op.id as plan_id,
    op.name,
    count(oa.id)::integer as assigned_count,
    count(*) filter (where public.is_onboarding_assignment_complete(oa.id))::integer as completed_count
  from public.onboarding_plans op
  join public.onboarding_assignments oa on oa.plan_id = op.id
  where op.org_id = p_org_id
  group by op.id, op.name
  order by op.created_at desc;
end;
$$;
```

- [ ] **Step 2: Apply the migration to the real Supabase project**

Use the Supabase MCP tool `apply_migration` with `project_id: "uktdipvvnbgzasqlpudl"`, `name: "org_dashboard_aggregates"`, and `query` set to the full SQL from Step 1. (This project has no local Supabase CLI/Docker stack in this environment — migrations are applied directly to the real project, same as this repo's existing migration history.)

Expected: the tool returns success with no errors. If it errors on `create index if not exists` because the index already exists from a previous partial run, that's fine — everything else should still apply cleanly since `create function` statements aren't otherwise conditional; if a `create function` fails because it already exists from a retry, add `or replace` to that one statement and re-run.

- [ ] **Step 3: Regenerate the TypeScript types**

Call the Supabase MCP tool `generate_typescript_types` with `project_id: "uktdipvvnbgzasqlpudl"`. It returns the full contents of the database types file. Open `src/lib/supabase/database.types.ts` and find the `Functions` block (currently ends with `is_super_admin: { Args: never; Returns: boolean }`). Replace the entire `Functions: { ... }` block with the one from the regenerated output verbatim — do not hand-edit individual lines, since the generator's exact formatting (e.g. how it types `numeric` columns, how it represents `Returns` for a set-returning function) must match what the rest of the file already expects. Confirm the new block includes all four new functions plus `is_onboarding_assignment_complete`, and still includes the three pre-existing ones (`can_manage_content`, `find_profile_id_by_email`, `is_org_admin`, `is_super_admin`).

- [ ] **Step 4: Verify each function directly with SQL against the demo org**

Using the Supabase MCP tool `execute_sql` with `project_id: "uktdipvvnbgzasqlpudl"`, run each of the following against org id `423b604d-9d87-4961-bb8f-864e1cf69b2b` and sanity-check the result:

```sql
select * from org_dashboard_kpis('423b604d-9d87-4961-bb8f-864e1cf69b2b');
```
Expected: one row. Cross-check `learner_count` and `seats_used` both equal the independently-known member count for this org (query `select count(*) from organization_memberships where org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b';` and confirm it matches). `seats_total` should be `null` (this org's `seats` column is unset). `passed_current <= attempts_current` and `passed_previous <= attempts_previous` must both hold. `cpd_available` must equal `learner_count` times the per-learner points sum — cross-check with:
```sql
select coalesce(sum(mod.cpd_points), 0) as per_learner_points
from modules mod
where mod.id in (
  select distinct cm.module_id from curriculum_modules cm
  join curricula c on c.id = cm.curriculum_id
  where c.status = 'published' and c.certificate_awarded = true
    and c.id in (select content_id from org_catalog_selections where org_id = '423b604d-9d87-4961-bb8f-864e1cf69b2b' and content_type = 'curriculum')
);
```
and confirm `cpd_available = learner_count * per_learner_points` from the first query's output.

```sql
select * from org_at_risk_learners('423b604d-9d87-4961-bb8f-864e1cf69b2b');
```
Expected: zero or more rows, each `user_id` also present in `organization_memberships` for this org, `reasons` a non-empty array drawn only from `{inactive, overdue_onboarding, low_performance}`.

```sql
select * from org_weakest_modules('423b604d-9d87-4961-bb8f-864e1cf69b2b', 5);
```
Expected: at most 5 rows, `average_score` values in ascending order (weakest first), each between 0 and 100.

```sql
select * from org_onboarding_completion('423b604d-9d87-4961-bb8f-864e1cf69b2b');
```
Expected: zero or more rows (zero is fine if this demo org has no onboarding plans with assignments yet), each `completed_count <= assigned_count`.

```sql
select org_dashboard_kpis('00000000-0000-0000-0000-000000000000');
```
Expected: raises `not authorized`. A raw SQL session via the `execute_sql` MCP tool has no `request.jwt.claims` set, so `auth.uid()` (which `is_org_admin` checks) resolves to `null`, and `null = anything` is never true — so this must fail the authorization check regardless of the arbitrary all-zeros org id. If it does NOT raise, stop and report BLOCKED — the authorization check inside the function is broken.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260918090000_org_dashboard_aggregates.sql src/lib/supabase/database.types.ts
git commit -m "Add scale-safe Postgres aggregate functions for the org dashboard"
```

---

### Task 2: Pure display-formatting helpers

**Files:**
- Create: `src/lib/org/format-org-dashboard.ts`
- Test: `src/lib/org/format-org-dashboard.test.ts`

**Interfaces:**
- Produces: `AtRiskReason` type (`"inactive" | "overdue_onboarding" | "low_performance"`), `formatAtRiskReasonLabel(reason: AtRiskReason): string`, `formatSeatsSummary(seatsUsed: number, seatsTotal: number | null): string` — both consumed by Task 4's page component.
- Consumes: nothing from other tasks (fully independent, pure).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/org/format-org-dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatAtRiskReasonLabel, formatSeatsSummary } from "./format-org-dashboard";

describe("formatAtRiskReasonLabel", () => {
  it("labels inactive", () => {
    expect(formatAtRiskReasonLabel("inactive")).toBe("Inactive 14+ days");
  });

  it("labels overdue onboarding", () => {
    expect(formatAtRiskReasonLabel("overdue_onboarding")).toBe("Onboarding overdue");
  });

  it("labels low performance", () => {
    expect(formatAtRiskReasonLabel("low_performance")).toBe("Below pass threshold");
  });
});

describe("formatSeatsSummary", () => {
  it("shows used / total when a seat cap exists", () => {
    expect(formatSeatsSummary(8, 20)).toBe("8 / 20");
  });

  it("shows just the used count when seats are unlimited (null total)", () => {
    expect(formatSeatsSummary(8, null)).toBe("8 (unlimited)");
  });

  it("handles zero used with a cap", () => {
    expect(formatSeatsSummary(0, 5)).toBe("0 / 5");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- format-org-dashboard`
Expected: FAIL — `Cannot find module './format-org-dashboard'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/org/format-org-dashboard.ts`:

```ts
export type AtRiskReason = "inactive" | "overdue_onboarding" | "low_performance";

const REASON_LABELS: Record<AtRiskReason, string> = {
  inactive: "Inactive 14+ days",
  overdue_onboarding: "Onboarding overdue",
  low_performance: "Below pass threshold",
};

export function formatAtRiskReasonLabel(reason: AtRiskReason): string {
  return REASON_LABELS[reason];
}

export function formatSeatsSummary(seatsUsed: number, seatsTotal: number | null): string {
  return seatsTotal === null ? `${seatsUsed} (unlimited)` : `${seatsUsed} / ${seatsTotal}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- format-org-dashboard`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean, no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/org/format-org-dashboard.ts src/lib/org/format-org-dashboard.test.ts
git commit -m "Add pure formatting helpers for at-risk reasons and seat usage"
```

---

### Task 3: Data wrapper calling the new RPC functions

**Files:**
- Create: `src/lib/org/get-org-dashboard.ts`

**Interfaces:**
- Consumes: the four RPC functions from Task 1 (`org_dashboard_kpis`, `org_at_risk_learners`, `org_weakest_modules`, `org_onboarding_completion`); `computePassRateTrend` and `PassRateTrend` from `src/lib/trends/trend-math.ts` (already exist, exact signature `computePassRateTrend(currentPassed: number, currentTotal: number, previousPassed: number, previousTotal: number): Omit<PassRateTrend, "sparkline">`).
- Produces (consumed by Task 4): `OrgDashboardKpis`, `AtRiskLearner`, `OrgWeakestModule`, `OnboardingPlanCompletion` types, and `getOrgDashboardKpis(supabase, orgId)`, `getAtRiskLearners(supabase, orgId)`, `getOrgWeakestModules(supabase, orgId, limit?)`, `getOnboardingCompletion(supabase, orgId)` — all `async`, taking `supabase: Awaited<ReturnType<typeof createClient>>` as their first argument (same pattern as `getOrgProgress`/`getCertificateProgress`).

Each function is independently exception-safe (catches its own errors and returns a safe default) — same resilience convention `get-dashboard-trends.ts` already established, so one broken RPC doesn't break the whole page.

- [ ] **Step 1: Write the implementation**

Create `src/lib/org/get-org-dashboard.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { computePassRateTrend, type PassRateTrend } from "@/lib/trends/trend-math";
import type { AtRiskReason } from "@/lib/org/format-org-dashboard";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OrgDashboardKpis = {
  learnerCount: number;
  seatsUsed: number;
  seatsTotal: number | null;
  passRateTrend: Omit<PassRateTrend, "sparkline">;
  cpdEarned: number;
  cpdAvailable: number;
  certificatesIssued: number;
};

export type AtRiskLearner = {
  userId: string;
  name: string;
  email: string;
  lastActivityAt: string | null;
  reasons: AtRiskReason[];
};

export type OrgWeakestModule = {
  moduleId: string;
  title: string;
  attemptCount: number;
  averageScore: number;
};

export type OnboardingPlanCompletion = {
  planId: string;
  name: string;
  assignedCount: number;
  completedCount: number;
  percentComplete: number;
};

const FLAT_KPIS: OrgDashboardKpis = {
  learnerCount: 0,
  seatsUsed: 0,
  seatsTotal: null,
  passRateTrend: { currentPassRate: null, previousPassRate: null, percentagePointChange: null, direction: "flat" },
  cpdEarned: 0,
  cpdAvailable: 0,
  certificatesIssued: 0,
};

export async function getOrgDashboardKpis(supabase: SupabaseClient, orgId: string): Promise<OrgDashboardKpis> {
  try {
    const { data, error } = await supabase.rpc("org_dashboard_kpis", { p_org_id: orgId }).single();
    if (error || !data) return FLAT_KPIS;

    return {
      learnerCount: data.learner_count,
      seatsUsed: data.seats_used,
      seatsTotal: data.seats_total,
      passRateTrend: computePassRateTrend(data.passed_current, data.attempts_current, data.passed_previous, data.attempts_previous),
      cpdEarned: data.cpd_earned,
      cpdAvailable: data.cpd_available,
      certificatesIssued: data.certificates_issued,
    };
  } catch {
    return FLAT_KPIS;
  }
}

export async function getAtRiskLearners(supabase: SupabaseClient, orgId: string): Promise<{ total: number; top: AtRiskLearner[] }> {
  try {
    const { data, error } = await supabase.rpc("org_at_risk_learners", { p_org_id: orgId });
    if (error || !data) return { total: 0, top: [] };

    const learners: AtRiskLearner[] = data.map((row) => ({
      userId: row.user_id,
      name: row.name,
      email: row.email,
      lastActivityAt: row.last_activity_at,
      reasons: (row.reasons ?? []) as AtRiskReason[],
    }));
    return { total: learners.length, top: learners.slice(0, 5) };
  } catch {
    return { total: 0, top: [] };
  }
}

export async function getOrgWeakestModules(supabase: SupabaseClient, orgId: string, limit = 5): Promise<OrgWeakestModule[]> {
  try {
    const { data, error } = await supabase.rpc("org_weakest_modules", { p_org_id: orgId, p_limit: limit });
    if (error || !data) return [];

    return data.map((row) => ({
      moduleId: row.module_id,
      title: row.title,
      attemptCount: row.attempt_count,
      averageScore: Number(row.average_score),
    }));
  } catch {
    return [];
  }
}

export async function getOnboardingCompletion(supabase: SupabaseClient, orgId: string): Promise<OnboardingPlanCompletion[]> {
  try {
    const { data, error } = await supabase.rpc("org_onboarding_completion", { p_org_id: orgId });
    if (error || !data) return [];

    return data.map((row) => ({
      planId: row.plan_id,
      name: row.name,
      assignedCount: row.assigned_count,
      completedCount: row.completed_count,
      percentComplete: row.assigned_count === 0 ? 0 : Math.round((row.completed_count / row.assigned_count) * 100),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If `tsc` complains that `supabase.rpc("org_dashboard_kpis", ...)` doesn't recognize the function name, Task 1's Step 3 (regenerating `database.types.ts`) wasn't completed correctly — go back and confirm the `Functions` block in that file actually contains all five new entries (four public ones plus `is_onboarding_assignment_complete`) before continuing.

- [ ] **Step 3: Live verification against the demo org**

Write a throwaway script, copy it into `node_modules/` so module resolution finds the installed `@supabase/supabase-js` package (the pattern already established in this repo — see prior sessions' verification scripts), and run it with the demo org admin's credentials:

```js
// node_modules/.tmp-verify-org-dashboard.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: "demo.orgadmin@optymumss.com",
  password: "HemoDemo2026!",
});
if (authError) throw authError;

const orgId = "423b604d-9d87-4961-bb8f-864e1cf69b2b";

const kpis = await supabase.rpc("org_dashboard_kpis", { p_org_id: orgId }).single();
console.log("kpis:", kpis.data, kpis.error);

const atRisk = await supabase.rpc("org_at_risk_learners", { p_org_id: orgId });
console.log("at-risk count:", atRisk.data?.length, atRisk.error);

const weakest = await supabase.rpc("org_weakest_modules", { p_org_id: orgId, p_limit: 5 });
console.log("weakest modules:", weakest.data, weakest.error);

const onboarding = await supabase.rpc("org_onboarding_completion", { p_org_id: orgId });
console.log("onboarding:", onboarding.data, onboarding.error);

// Authorization check: a non-admin (the demo learner) must be rejected.
await supabase.auth.signOut();
const { error: learnerAuthError } = await supabase.auth.signInWithPassword({
  email: "demo.learner@optymumss.com",
  password: "HemoDemo2026!",
});
if (learnerAuthError) throw learnerAuthError;
const rejected = await supabase.rpc("org_dashboard_kpis", { p_org_id: orgId });
console.log("non-admin call error (expected 'not authorized' or similar):", rejected.error);
```

Run: `cp <script> node_modules/.tmp-verify-org-dashboard.mjs && node --env-file=.env.local node_modules/.tmp-verify-org-dashboard.mjs`

Expected: all four RPC calls for the org admin succeed with no `error`, returning data shaped as in Task 1's verification. The final call (as the demo learner, a `member` not an `owner`/`admin`) must come back with a non-null `error` — this is the real authorization check Task 1 couldn't fully exercise via raw SQL. If it does NOT error, stop and report BLOCKED — this would mean a learner can read org-wide dashboard data, a real authorization bug in Task 1's SQL that must be fixed before continuing.

Delete the temp file after: `rm -f node_modules/.tmp-verify-org-dashboard.mjs`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/org/get-org-dashboard.ts
git commit -m "Add get-org-dashboard.ts: typed wrapper around the org dashboard RPC functions"
```

---

### Task 4: Assemble the org dashboard page

**Files:**
- Modify: `src/app/org/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getCurrentOrg` (existing, unchanged), `ComingSoon` (existing, unchanged), `createClient` (existing), `getOrgDashboardKpis`/`getAtRiskLearners`/`getOrgWeakestModules`/`getOnboardingCompletion` and their types from Task 3, `formatAtRiskReasonLabel`/`formatSeatsSummary` from Task 2, `formatPassRateTrendLabel` from `src/lib/learner/format-trend-label.ts` (existing, unchanged — its signature requires a full `PassRateTrend` including `sparkline`, so this page passes `{ ...kpis.passRateTrend, sparkline: { points: [] } }`, the same dummy-sparkline pattern this codebase's own `format-trend-label.test.ts` already uses, since the function never reads that field).

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
} from "@/lib/org/get-org-dashboard";
import { formatPassRateTrendLabel } from "@/lib/learner/format-trend-label";
import { formatAtRiskReasonLabel, formatSeatsSummary } from "@/lib/org/format-org-dashboard";

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
  const [kpis, atRisk, weakestModules, onboarding] = await Promise.all([
    getOrgDashboardKpis(supabase, org.id),
    getAtRiskLearners(supabase, org.id),
    getOrgWeakestModules(supabase, org.id),
    getOnboardingCompletion(supabase, org.id),
  ]);

  const passRateLabel = formatPassRateTrendLabel({ ...kpis.passRateTrend, sparkline: { points: [] } });

  return (
    <div>
      <h1 className="text-xl font-semibold">{org.name}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Manage your roster, choose what your learners study from the published catalog, and track team progress.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.learnerCount}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Avg Quiz Pass Rate</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.passRateTrend.currentPassRate === null ? "—" : `${Math.round(kpis.passRateTrend.currentPassRate)}%`}
          </p>
          <p className="mt-1 text-xs text-ink-dim">{passRateLabel}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">CPD Points</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.cpdEarned} / {kpis.cpdAvailable}
          </p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Certificates Issued</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.certificatesIssued}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
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
                    <td className="px-4 py-2 font-medium">{learner.name}</td>
                    <td className="px-4 py-2 text-ink-dim">{learner.reasons.map(formatAtRiskReasonLabel).join(", ")}</td>
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
                  <th className="px-4 py-2">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {weakestModules.map((m) => (
                  <tr key={m.moduleId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{m.title}</td>
                    <td className="px-4 py-2 text-ink-dim">{m.attemptCount}</td>
                    <td className={`px-4 py-2 ${m.averageScore < 70 ? "text-warning-soft-ink" : "text-ink-dim"}`}>
                      {m.averageScore}%
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
Expected: all clean, all tests passing (including the pre-existing suite untouched by this plan).

- [ ] **Step 3: Commit**

```bash
git add src/app/org/page.tsx
git commit -m "Assemble the org admin dashboard page"
```

---

### Task 5: Live verification

**Files:** none (verification only — no code changes).

**Interfaces:** none produced. Consumes the fully assembled page from Task 4.

- [ ] **Step 1: Write and run a Playwright verification script**

Follow the same pattern as the learner dashboard's live-verification task: write a throwaway script to the scratchpad directory, launch Chromium at `/opt/pw-browsers/chromium`, and check the following against `http://localhost:3000` (start the dev server first if it isn't already running):

1. Log in as `demo.orgadmin@optymumss.com` / `HemoDemo2026!`, navigate to `/org`.
2. Desktop (1600×1000), light theme: screenshot full page. Confirm via `page.locator("body").innerText()` that the page contains "Learners", "Avg Quiz Pass Rate", "CPD Points", "Certificates Issued", "Seats", "At-Risk Learners", "Weakest Modules" (remember Tailwind `uppercase` classes transform `innerText` to all-caps — match case-insensitively or check for the transformed text, the same gotcha hit during the learner dashboard's verification).
3. Toggle to dark theme, screenshot full page — confirm it renders without errors (no broken contrast, no missing content).
4. Mobile viewport (390×844): screenshot full page, and confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2` (no horizontal overflow).
5. Confirm the "Onboarding Completion" section is present only if the demo org has any onboarding plans with assignments (check the live `org_onboarding_completion` result from Task 3's verification to know which to expect) — if it has zero, confirm the section is entirely absent (not an empty table), matching the spec's "omit rather than show empty" rule.
6. Click each "View all" link once and confirm it navigates to the expected existing page (`/org/roster`, `/org/analytics` twice, `/org/onboarding` if shown) without a 404 or error page.

- [ ] **Step 2: Report findings**

Write a short summary (in the progress ledger, following this session's established convention) covering: what rendered correctly, any visual issues found, and — importantly — whether the KPI numbers and at-risk/weakest-modules lists visually match what Task 1/3's direct SQL and RPC verification already showed for this same org (a mismatch would indicate a bug in the page's data-fetching or rendering, not the data layer).

No commit for this task (verification only, no files changed).
