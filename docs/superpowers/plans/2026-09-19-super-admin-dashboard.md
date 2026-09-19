# Super-Admin Cross-Org Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in `/admin`'s currently-static blurb with a real cross-organization overview for `super_admin` users — org/learner counts, seat-utilization flagging, and recent-signups — reusing the exact visual system already built for `/org`.

**Architecture:** One new plain SQL function aggregates one row per organization (no `SECURITY DEFINER` needed — `super_admin` already has full RLS visibility on the underlying tables). A new pure function derives all the dashboard's numbers from that already-small result set in TypeScript, tested directly with synthetic rows. `content_manager`'s existing view is untouched.

**Tech Stack:** Next.js App Router (server components), Supabase (Postgres + RLS + RPC), Tailwind v4 (existing tokens), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-super-admin-dashboard-design.md`

## Global Constraints

- Zero new visual components — every element reuses the exact Tailwind classes and JSX structure already established on `src/app/org/page.tsx` this engagement (accent-edge cards, table/thead/tbody with a `bg-surface-sunken` header row, `border-t border-line` rows, `text-accent` "View all" links, the `colSpan` empty-state row).
- No donut/radial rings, no calendar — declined by the user in favor of visual consistency with the rest of the app.
- `content_manager`'s branch of `/admin/page.tsx` must render byte-for-byte the same text it does today — only the `super_admin` branch changes.
- Do not modify `/admin/organizations`, `/admin/tiers`, `/admin/learners`, or any RLS policy — this plan only adds one new SQL function and rewrites `/admin/page.tsx`.
- The new SQL function must NOT be `SECURITY DEFINER` and must NOT include an `is_super_admin()` gate — it relies entirely on the existing "... super admin full access" RLS policies already present on `organizations` and `organization_memberships`.

**Demo data and accounts for live verification (all tasks that need it):**
- Supabase project id: `uktdipvvnbgzasqlpudl`.
- Exactly one organization exists on the platform right now: "Demo Organization" (`423b604d-9d87-4961-bb8f-864e1cf69b2b`), `seats: null`, `status: active`, 2 members, `created_at: 2026-07-31` (outside any 30-day window as of today) — expect the "Near/At Seat Limit" list to be legitimately empty and "Recently Created" to show exactly this one org in live verification.
- `demo.superadmin@optymumss.com` / `HemoDemo2026!` (role `super_admin`) — the positive/authorized view.
- `demo.orgadmin@optymumss.com` / `HemoDemo2026!` (role `org_admin`) — the negative/RLS-boundary test.

---

### Task 1: Platform org-summary SQL function

**Files:**
- Create: `supabase/migrations/20260919100000_platform_org_summary.sql`
- Modify: `src/lib/supabase/database.types.ts` (append the new function to the `Functions` block)

**Interfaces:**
- Produces: `platform_org_summary()` (no arguments) → one row per organization: `{ org_id: uuid, name: text, seats: integer | null, status: text, created_at: timestamptz, member_count: integer }`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260919100000_platform_org_summary.sql`:

```sql
-- Super-admin cross-org dashboard: one row per organization with its
-- member count, computed as a single grouped join rather than fetching
-- membership rows into Node. Deliberately NOT security definer and NOT
-- gated by is_super_admin() — organizations and organization_memberships
-- both already carry a "super admin full access" RLS policy, so a plain
-- invoker-rights function is naturally safe: RLS on the underlying tables
-- governs what any caller sees, the same trust boundary every other
-- direct .from(...) read in this codebase already relies on. A
-- non-super-admin caller gets back only whatever their own RLS already
-- permits (e.g. an org_admin sees at most their own org's row) — never
-- the platform-wide list.
create function public.platform_org_summary()
returns table (
  org_id uuid,
  name text,
  seats integer,
  status text,
  created_at timestamptz,
  member_count integer
)
language sql
stable
set search_path = public
as $$
  select o.id, o.name, o.seats, o.status, o.created_at, count(m.user_id)::integer as member_count
  from public.organizations o
  left join public.organization_memberships m on m.org_id = o.id
  group by o.id, o.name, o.seats, o.status, o.created_at
  order by o.name;
$$;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool `apply_migration` with `project_id: "uktdipvvnbgzasqlpudl"`, `name: "platform_org_summary"`, and `query` set to the SQL from Step 1.

Expected: success, no errors.

- [ ] **Step 3: Regenerate TypeScript types**

Call the Supabase MCP tool `generate_typescript_types` with `project_id: "uktdipvvnbgzasqlpudl"`. If the result is too large to return inline, it will be saved to a file — extract just the `Functions: { ... }` block (find `Functions: {` and match balanced braces) rather than reading the whole file. Replace the existing `Functions: { ... }` block in `src/lib/supabase/database.types.ts` with the regenerated one verbatim. Confirm the new block includes `platform_org_summary` alongside every function from the two prior org-dashboard plans.

- [ ] **Step 4: Verify the function directly via SQL**

Using the Supabase MCP tool `execute_sql` with `project_id: "uktdipvvnbgzasqlpudl"`:

```sql
select * from platform_org_summary();
```

Expected: **zero rows.** The `execute_sql` MCP tool runs with no JWT session context, so `auth.uid()` is null there. Both of `organizations`' RLS policies gate on that value — `"super admin full access"` via `is_super_admin()` (itself an `auth.uid()`-based lookup) and `"members can view their own org"` via `user_id = auth.uid()` inside an `exists(...)` — and `null = anything` is never true, so every row is filtered out before the function's `left join` even runs. A zero-row result here is confirmation the SQL is well-formed and the RLS boundary is doing something, not a failure. The real, authenticated-session behavior (which must return the one real org for `super_admin`) is verified in Task 3.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919100000_platform_org_summary.sql src/lib/supabase/database.types.ts
git commit -m "Add platform_org_summary SQL function for the super-admin dashboard"
```

---

### Task 2: Pure aggregation logic

**Files:**
- Create: `src/lib/admin/get-platform-summary.ts` (this task writes the pure function and types; Task 3 adds the Supabase-calling wrapper to the same file)
- Test: `src/lib/admin/get-platform-summary.test.ts`

**Interfaces:**
- Produces (consumed by Task 3 and Task 4): `PlatformOrgRow` (the raw RPC row shape), `PlatformOrgSummary` (the derived shape), `summarizePlatformOrgs(rows: PlatformOrgRow[], now: Date): PlatformOrgSummary`.

Note on design: the spec asked for `getPlatformOrgSummary(supabase): Promise<PlatformOrgSummary>` as the wrapper (built in Task 3), but didn't separately name a pure function for the aggregation math itself. This plan splits that math out into its own pure `summarizePlatformOrgs(rows, now)` — taking `now` as an explicit parameter rather than reading the system clock — because that's the only way to write deterministic, non-flaky tests for the 30-day-window logic, and it's the exact pattern `buildTrend(timestamps, now)` already established in `trend-math.ts`. Without this split, the spec's own requirement for "Vitest unit tests on synthetic rows" covering window/threshold boundaries would have no seam to test against.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/get-platform-summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { summarizePlatformOrgs, type PlatformOrgRow } from "./get-platform-summary";

const now = new Date(Date.UTC(2026, 8, 19, 12, 0, 0)); // 2026-09-19 12:00 UTC

function makeRow(overrides: Partial<PlatformOrgRow> & { org_id: string }): PlatformOrgRow {
  return {
    org_id: overrides.org_id,
    name: overrides.name ?? `Org ${overrides.org_id}`,
    seats: overrides.seats ?? null,
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? new Date(Date.UTC(2026, 0, 1)).toISOString(),
    member_count: overrides.member_count ?? 0,
  };
}

describe("summarizePlatformOrgs", () => {
  it("counts total, active, and suspended organizations", () => {
    const rows = [
      makeRow({ org_id: "a", status: "active" }),
      makeRow({ org_id: "b", status: "active" }),
      makeRow({ org_id: "c", status: "suspended" }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.totalOrgs).toBe(3);
    expect(result.activeOrgs).toBe(2);
    expect(result.suspendedOrgs).toBe(1);
  });

  it("sums member_count across all orgs for totalLearners", () => {
    const rows = [makeRow({ org_id: "a", member_count: 5 }), makeRow({ org_id: "b", member_count: 12 })];
    expect(summarizePlatformOrgs(rows, now).totalLearners).toBe(17);
  });

  it("counts an org created exactly 30 days ago as within the window (inclusive lower edge)", () => {
    const exactlyThirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = [makeRow({ org_id: "a", created_at: exactlyThirtyDaysAgo.toISOString() })];
    expect(summarizePlatformOrgs(rows, now).newLast30Days).toBe(1);
  });

  it("excludes an org created 31 days ago from newLast30Days", () => {
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const rows = [makeRow({ org_id: "a", created_at: thirtyOneDaysAgo.toISOString() })];
    expect(summarizePlatformOrgs(rows, now).newLast30Days).toBe(0);
  });

  it("excludes orgs with unlimited (null) seats from near-seat-limit, regardless of member count", () => {
    const rows = [makeRow({ org_id: "a", seats: null, member_count: 10000 })];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(0);
    expect(result.nearSeatLimit).toEqual([]);
  });

  it("includes an org at exactly 90% utilization (inclusive threshold)", () => {
    const rows = [makeRow({ org_id: "a", seats: 10, member_count: 9 })];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(1);
    expect(result.nearSeatLimit[0].utilizationPercent).toBe(90);
  });

  it("excludes an org at 89% utilization", () => {
    const rows = [makeRow({ org_id: "a", seats: 100, member_count: 89 })];
    expect(summarizePlatformOrgs(rows, now).nearSeatLimitCount).toBe(0);
  });

  it("reports the full near-seat-limit count even when more than 5 orgs qualify, while the list stays capped at 5", () => {
    const rows = Array.from({ length: 7 }, (_, i) => makeRow({ org_id: `org-${i}`, seats: 10, member_count: 10 }));
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(7);
    expect(result.nearSeatLimit).toHaveLength(5);
  });

  it("sorts near-seat-limit orgs by utilization descending", () => {
    const rows = [
      makeRow({ org_id: "a", name: "Lower", seats: 10, member_count: 9 }),
      makeRow({ org_id: "b", name: "Higher", seats: 10, member_count: 10 }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimit.map((o) => o.name)).toEqual(["Higher", "Lower"]);
  });

  it("returns recentlyCreated sorted newest-first, independent of the 30-day window", () => {
    const rows = [
      makeRow({ org_id: "a", name: "Old", created_at: new Date(Date.UTC(2020, 0, 1)).toISOString() }),
      makeRow({ org_id: "b", name: "New", created_at: new Date(Date.UTC(2026, 8, 18)).toISOString() }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.recentlyCreated.map((o) => o.name)).toEqual(["New", "Old"]);
  });

  it("returns fewer than 5 recentlyCreated entries when fewer than 5 orgs exist, without padding", () => {
    const rows = [makeRow({ org_id: "a" }), makeRow({ org_id: "b" })];
    expect(summarizePlatformOrgs(rows, now).recentlyCreated).toHaveLength(2);
  });

  it("returns a fully zeroed/empty summary for zero organizations", () => {
    const result = summarizePlatformOrgs([], now);
    expect(result.totalOrgs).toBe(0);
    expect(result.totalLearners).toBe(0);
    expect(result.nearSeatLimitCount).toBe(0);
    expect(result.nearSeatLimit).toEqual([]);
    expect(result.recentlyCreated).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- get-platform-summary`
Expected: FAIL — `Cannot find module './get-platform-summary'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/admin/get-platform-summary.ts`:

```ts
const SEAT_LIMIT_THRESHOLD = 0.9;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type PlatformOrgRow = {
  org_id: string;
  name: string;
  seats: number | null;
  status: string;
  created_at: string;
  member_count: number;
};

export type PlatformOrgSummary = {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalLearners: number;
  newLast30Days: number;
  nearSeatLimitCount: number;
  nearSeatLimit: { orgId: string; name: string; memberCount: number; seats: number; utilizationPercent: number }[];
  recentlyCreated: { orgId: string; name: string; createdAt: string }[];
};

export function summarizePlatformOrgs(rows: PlatformOrgRow[], now: Date): PlatformOrgSummary {
  const totalOrgs = rows.length;
  const activeOrgs = rows.filter((r) => r.status === "active").length;
  const suspendedOrgs = rows.filter((r) => r.status === "suspended").length;
  const totalLearners = rows.reduce((sum, r) => sum + r.member_count, 0);

  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);
  const newLast30Days = rows.filter((r) => new Date(r.created_at) >= thirtyDaysAgo).length;

  const nearLimitAll = rows
    .filter((r) => r.seats !== null && r.seats > 0 && r.member_count / r.seats >= SEAT_LIMIT_THRESHOLD)
    .map((r) => ({
      orgId: r.org_id,
      name: r.name,
      memberCount: r.member_count,
      seats: r.seats as number,
      utilizationPercent: Math.round((r.member_count / (r.seats as number)) * 100),
    }))
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const recentlyCreated = [...rows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((r) => ({ orgId: r.org_id, name: r.name, createdAt: r.created_at }));

  return {
    totalOrgs,
    activeOrgs,
    suspendedOrgs,
    totalLearners,
    newLast30Days,
    nearSeatLimitCount: nearLimitAll.length,
    nearSeatLimit: nearLimitAll.slice(0, 5),
    recentlyCreated,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- get-platform-summary`
Expected: PASS, 12/12 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/get-platform-summary.ts src/lib/admin/get-platform-summary.test.ts
git commit -m "Add summarizePlatformOrgs: pure aggregation logic for the super-admin dashboard"
```

---

### Task 3: Data wrapper calling the RPC

**Files:**
- Modify: `src/lib/admin/get-platform-summary.ts` (add the Supabase-calling wrapper)

**Interfaces:**
- Consumes: `platform_org_summary` RPC (Task 1); `summarizePlatformOrgs`, `PlatformOrgSummary` (Task 2, same file).
- Produces (consumed by Task 4): `getPlatformOrgSummary(supabase: SupabaseClient): Promise<PlatformOrgSummary>`.

- [ ] **Step 1: Add the wrapper**

Add to the top of `src/lib/admin/get-platform-summary.ts` (after the existing top-of-file constants, before the type definitions — the import needs to come first):

```ts
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
```

Then add at the end of the file:

```ts
const EMPTY_SUMMARY: PlatformOrgSummary = {
  totalOrgs: 0,
  activeOrgs: 0,
  suspendedOrgs: 0,
  totalLearners: 0,
  newLast30Days: 0,
  nearSeatLimitCount: 0,
  nearSeatLimit: [],
  recentlyCreated: [],
};

export async function getPlatformOrgSummary(supabase: SupabaseClient): Promise<PlatformOrgSummary> {
  try {
    const { data, error } = await supabase.rpc("platform_org_summary");
    if (error || !data) return EMPTY_SUMMARY;
    return summarizePlatformOrgs(data, new Date());
  } catch {
    return EMPTY_SUMMARY;
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If `tsc` complains that `supabase.rpc("platform_org_summary")` doesn't recognize the function name, Task 1's Step 3 (regenerating `database.types.ts`) wasn't completed correctly.

- [ ] **Step 3: Re-run the unit tests to confirm nothing broke**

Run: `npm run test -- get-platform-summary`
Expected: PASS, still 12/12 (this step only added a new export; `summarizePlatformOrgs` itself is unchanged).

- [ ] **Step 4: Live verification — positive case (super_admin)**

Write a throwaway script, copy it into `node_modules/` (this repo's established pattern), and run it:

```js
// node_modules/.tmp-verify-platform-summary.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { error: authError } = await supabase.auth.signInWithPassword({
  email: "demo.superadmin@optymumss.com",
  password: "HemoDemo2026!",
});
if (authError) throw authError;

const result = await supabase.rpc("platform_org_summary");
console.log("super_admin rows:", JSON.stringify(result.data, null, 2), "error:", result.error);

// Negative/RLS-boundary case: a non-super-admin must NOT see platform-wide data.
await supabase.auth.signOut();
const { error: orgAdminAuthError } = await supabase.auth.signInWithPassword({
  email: "demo.orgadmin@optymumss.com",
  password: "HemoDemo2026!",
});
if (orgAdminAuthError) throw orgAdminAuthError;

const restricted = await supabase.rpc("platform_org_summary");
console.log("org_admin rows:", JSON.stringify(restricted.data, null, 2), "error:", restricted.error);
```

Run: `cp <script> node_modules/.tmp-verify-platform-summary.mjs && node --env-file=.env.local node_modules/.tmp-verify-platform-summary.mjs`

Expected for the `super_admin` call: exactly 1 row (only one org exists on the platform right now), `name: "Demo Organization"`, `seats: null`, `status: "active"`, `member_count: 2`, no error.

Expected for the `org_admin` call: **this is the RLS-reliance safety proof the spec requires.** There is no explicit gate on this function — the correct outcome is whatever `organizations`' and `organization_memberships`' own RLS policies permit an `org_admin` to see, not a blanket authorization error. Since `demo.orgadmin` is a member of the same single demo org that exists on the platform, the most likely correct result is **exactly 1 row for that same org** (via "organizations: members can view their own org") — the meaningful check is not "zero rows" but that this row count can never exceed what a real platform with multiple orgs would let this user see. Confirm the row(s) returned belong only to org(s) `demo.orgadmin` actually belongs to — if the result ever included a *different* organization's row, that would be a genuine RLS gap and this task is BLOCKED until fixed (report it rather than proceeding). With only one organization on the platform this specific check can't fully distinguish "correctly scoped" from "accidentally unscoped" — note this limitation in your report; Task 4's manual re-check after any future second organization exists would close that gap, but is out of scope to fabricate here.

Delete the temp file after: `rm -f node_modules/.tmp-verify-platform-summary.mjs`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/get-platform-summary.ts
git commit -m "Add getPlatformOrgSummary wrapper for the super-admin dashboard"
```

---

### Task 4: Assemble the dashboard page

**Files:**
- Modify: `src/app/admin/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getCurrentProfile` (existing, unchanged); `createClient` (existing); `getPlatformOrgSummary` (Task 3).

Two things this task deliberately simplifies relative to the spec's wording, both worth being explicit about:

1. The spec's mockup phrasing said "Created (relative date, e.g. '3 days ago')" — this codebase has no relative-time formatting utility anywhere (confirmed by search). Introducing one just for a single date column isn't worth it; this task renders the plain date via `toLocaleDateString()` instead. A relative-time helper is a reasonable future addition if more of the app needs one.
2. `content_manager`'s branch must be pixel-identical to what exists today — copy its JSX exactly, don't rewrite it "while we're in here."

- [ ] **Step 1: Replace the page**

Replace the full contents of `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getPlatformOrgSummary } from "@/lib/admin/get-platform-summary";

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  const isSuperAdmin = profile?.role === "super_admin";

  if (!isSuperAdmin) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Content Manager</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Author and submit content for review — Library, Module, and Case Management. A Super Admin approves before
          anything reaches the published catalog.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const summary = await getPlatformOrgSummary(supabase);

  return (
    <div>
      <h1 className="text-xl font-semibold">Super Admin</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Full platform control: content library, review queue, organizations, tiers, and the site CMS.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Organizations</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totalOrgs}</p>
          <p className="mt-1 text-xs text-ink-dim">
            {summary.activeOrgs} active &middot; {summary.suspendedOrgs} suspended
          </p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{summary.totalLearners}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">Near/At Seat Limit</p>
          <p className="mt-1 text-2xl font-semibold">{summary.nearSeatLimitCount}</p>
        </div>
        <div className="rounded-lg border border-line border-l-4 border-l-accent p-4">
          <p className="text-xs uppercase text-ink-faint">New (Last 30 Days)</p>
          <p className="mt-1 text-2xl font-semibold">{summary.newLast30Days}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Near/At Seat Limit</h2>
            <Link href="/admin/organizations" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2">Seats</th>
                  <th className="px-4 py-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {summary.nearSeatLimit.map((org) => (
                  <tr key={org.orgId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{org.name}</td>
                    <td className="px-4 py-2 text-ink-dim">
                      {org.memberCount} / {org.seats}
                    </td>
                    <td className="px-4 py-2 text-ink-dim">{org.utilizationPercent}%</td>
                  </tr>
                ))}
                {summary.nearSeatLimit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                      No organizations near their seat limit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recently Created Organizations</h2>
            <Link href="/admin/organizations" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Organization</th>
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentlyCreated.map((org) => (
                  <tr key={org.orgId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{org.name}</td>
                    <td className="px-4 py-2 text-ink-dim">{new Date(org.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {summary.recentlyCreated.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-ink-faint">
                      No organizations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint, and run the full test suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean, all tests passing (108/108 — the 96 from before this plan plus the 12 new ones from Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "Assemble the super-admin cross-org dashboard page"
```

---

### Task 5: Live verification

**Files:** none (verification only — no code changes).

**Interfaces:** none produced. Consumes the fully assembled page from Task 4.

- [ ] **Step 1: Write and run a Playwright verification script**

Start the dev server if it isn't already running, then log in as `demo.superadmin@optymumss.com` / `HemoDemo2026!` and navigate to `/admin`. Check, for **both** light and dark themes:

1. Desktop (1600×1000): screenshot full page in light theme, then toggle to dark and screenshot again.
2. Confirm all 4 KPI cards show the accent left-border and the real current platform data: Organizations = 1 (with "1 active · 0 suspended" subtext), Learners = 2, Near/At Seat Limit = 0, New (Last 30 Days) = 0.
3. Confirm the "Near/At Seat Limit" table shows its empty-state row ("No organizations near their seat limit.") — there's genuinely nothing to list right now, this isn't a bug.
4. Confirm the "Recently Created Organizations" table shows exactly one row, "Demo Organization", with a real formatted date (not "Invalid Date" or blank).
5. Log in separately as `demo.contentmanager@optymumss.com` / `HemoDemo2026!`, navigate to `/admin`, and confirm the page shows the **unchanged** "Content Manager" heading and blurb — no KPI cards, no tables. This confirms the role branch wasn't accidentally widened.
6. Mobile viewport (390×844): screenshot full page as `demo.superadmin`, confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2` (no horizontal overflow).
7. Click each "View all" link once and confirm it navigates to `/admin/organizations` without an error page.

- [ ] **Step 2: Report findings**

Write a short summary covering: what rendered correctly in both themes, confirmation the `content_manager` view is untouched, and confirmation the KPI/table values match Task 3's live RPC output exactly (1 org, 2 learners, 0 near limit, 1 recently-created).

No commit for this task (verification only, no files changed).
