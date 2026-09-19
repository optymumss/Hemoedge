# Super-Admin Cross-Org Dashboard — Design Spec

## Overview

`/admin` — the landing page for both `super_admin` and `content_manager` roles, and already labeled "Dashboard" in the admin nav — is currently a static one-paragraph blurb. This spec fills it in with a real cross-organization overview, for `super_admin` only: HemoEdge staff managing every organization on the platform, as distinct from the org-admin dashboard (`/org`, shipped and polished in PRs #56/#57) which one organization's own admin uses for their own roster.

**Visual reference:** the user provided a second "Solis"-style component sheet (radial/donut rings, small bar/line charts, a calendar) as layout inspiration. After discussion, this spec deliberately does **not** adopt the donut-ring style — every visual element reuses the exact card/table/badge components already built for `/org`, to keep all three portals (`/admin`, `/org`, `/app`) visually consistent, which was the point of the earlier sidebar-unification work. The reference's calendar widget is also excluded — there's no platform-wide, date-driven feature to back it (onboarding due dates are per-org, not global).

## Goals

- One page a super_admin lands on that answers "how is the platform doing across every org" at a glance.
- Org and learner counts (totals, active/suspended split, growth).
- Seat-utilization visibility — which orgs are near or at capacity, since that's an upsell/expansion signal.
- Zero new visual components — pure reuse of `/org`'s already-established card/list/badge styling.

## Non-goals

- No engagement/pass-rate rollup across orgs, and no tier/billing breakdown — the user explicitly scoped this pass to org & learner counts and seat utilization only. Both are natural follow-ups, not part of this spec.
- No changes to `/admin/organizations`, `/admin/tiers`, `/admin/learners`, or any other existing `/admin` page — this spec only touches `/admin/page.tsx` and adds one new data source.
- No change to what `content_manager` sees at `/admin` — they keep the existing static blurb, unchanged. Only `super_admin` gets the new dashboard.
- No radial/donut rings, no calendar — explicitly declined in favor of visual consistency with the rest of the app.

## Data Layer

Unlike the org-admin dashboard's aggregate functions, this one does **not** need `SECURITY DEFINER` or a manual authorization gate. `organizations` and `organization_memberships` both already have a `"... : super admin full access"` RLS policy (`using (is_super_admin())`), confirmed by reading the existing migrations — a `super_admin` session already has full read access to both tables directly. A plain (default `SECURITY INVOKER`) SQL function that simply aggregates is therefore naturally safe: RLS on the underlying tables governs what any caller sees, exactly the same trust boundary every other direct `.from(...)` read in this codebase already relies on (e.g. `getCurrentOrg()`). This also means the function is harmless if a non-super-admin ever called it directly — RLS would limit it to at most their own org's already-visible row, the same information they can already see elsewhere in the app.

**New SQL function:** `platform_org_summary()` — no arguments, returns one row per organization: `{ org_id uuid, name text, seats integer, status text, created_at timestamptz, member_count integer }`, computed as a single grouped join (`organizations` left-joined to a `count` over `organization_memberships`, grouped by org) — never fetching raw membership rows into Node. Row count equals the number of organizations on the platform (expected to be small — tens to low hundreds — unlike per-org learner counts, which is the axis the org-admin dashboard's 2–10,000 scale constraint was about).

**New wrapper:** `getPlatformOrgSummary(supabase): Promise<PlatformOrgSummary>` in `src/lib/admin/get-platform-summary.ts`, calling the RPC and deriving:

```ts
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
```

- `totalLearners` = sum of `member_count` across all rows.
- `activeOrgs` / `suspendedOrgs` = split by `status`.
- `newLast30Days` = count of orgs whose `created_at` is within the last 30 days — a rolling window, not calendar-month, matching every other "last 30 days" metric already built this engagement (the KPI card is labeled "New (Last 30 Days)", not "New This Month", so the label and the data agree).
- Orgs near/at seat limit = those where `seats` is not null and `member_count / seats >= 0.9` (90%) — orgs with unlimited seats (`seats: null`) are excluded, since there's no ceiling to be "near." `nearSeatLimitCount` is the **full** count of such orgs (this is what the KPI card shows); `nearSeatLimit` is only the top 5 by `utilizationPercent` descending (for the list section below). Keeping these as two separate fields — rather than having the KPI card read `nearSeatLimit.length` — avoids the exact bug the org-admin dashboard's at-risk-learner count already had to solve: a slice-length used as a count silently under-reports once there are more matches than the slice holds.
- `recentlyCreated` = all orgs sorted by `created_at` descending, top 5 — independent of the 30-day window, so it still shows the 5 newest orgs even if none were created in the last 30 days.

Same exception-safety convention as every other dashboard wrapper this engagement: catches its own errors, returns a zeroed/empty `PlatformOrgSummary` on failure rather than throwing.

## UI Structure (`/admin/page.tsx`)

```
if role !== super_admin: unchanged existing blurb (content_manager's current view)

else:
  Header: "Super Admin" + existing blurb (unchanged)

  KPI row (4 cards, same accent-edge style as /org):
    [Organizations]  [Learners]  [Near/At Seat Limit]  [New (Last 30 Days)]
    "Organizations" card shows "{activeOrgs} active · {suspendedOrgs} suspended" as subtext.
    "Near/At Seat Limit" card shows nearSeatLimitCount (the full count, not the top-5 list's length).

  Orgs Near/At Seat Limit (top 5, same table/badge style as /org's At-Risk Learners):
    Name | Seats (e.g. "18 / 20") | Utilization (e.g. "90%")
    "View all →" → /admin/organizations

  Recently Created Organizations (top 5, same table style as /org's Weakest Modules):
    Name | Created (relative date, e.g. "3 days ago")
    "View all →" → /admin/organizations
```

**Empty/zero states:** zero organizations on the platform — KPI row still renders (0s), both lists show a "No organizations yet" row, matching the existing empty-state text already used on `/admin/organizations`. No orgs near their seat limit — that list's empty row says "No organizations near their seat limit."

## Testing & Verification Plan

- `platform_org_summary()` verified directly via SQL against the real platform data (the actual demo org(s) already in this project), cross-checked against independent `count(*)` queries on `organizations` and `organization_memberships`.
- `getPlatformOrgSummary`'s derived math (active/suspended split, 90% seat-limit threshold, 30-day window, top-5 sorts) gets Vitest unit tests on synthetic rows — this is the first dashboard wrapper this engagement where the *aggregation* logic itself (not just RPC plumbing) lives in TS rather than SQL, since the per-org row count is small enough that deriving totals/filters/sorts in JS from one already-small result set is simpler than pushing every derived number into the SQL function.
- Live verification: since RLS (not a `SECURITY DEFINER` gate) is what protects this function, live verification must include signing in as a **non**-super-admin (e.g. the demo org admin) and confirming the RPC does not return platform-wide data — only whatever that user's own RLS already permits them to see, if anything.
- Final live Playwright verification as `super_admin`, both light and dark themes, matching the checklist shape used for every prior dashboard task this engagement (no mobile horizontal overflow, links resolve correctly, empty states verified by reasoning about the real current data rather than needing a fabricated empty-platform fixture).
