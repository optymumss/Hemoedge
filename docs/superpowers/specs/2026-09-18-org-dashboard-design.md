# Org Admin Dashboard — Design Spec

## Overview

`/org` (the org-admin-facing shell) already has a working nav — Roster, Onboarding Plans, Catalog, Analytics, Reports, Billing — but its landing page (`/org/page.tsx`, the "Dashboard" nav item) is a bare title and one sentence of blurb. This spec fills that page in with a real summary dashboard for the person who manages one organization's HemoEdge account (an `org_admin`/`owner` in `organization_memberships`).

**Pattern:** summary-with-drill-down, not absorption. Every comparable admin surface (GitHub's `github.com/orgs/<org>`, Docebo, TalentLMS, Coursera for Business) puts a thin, fast-loading KPI/highlights view at the front door and pushes full tables to dedicated pages. `/org/analytics` (weakest-modules table + full learner list) and `/org/reports` (CSV export) already exist and keep working unchanged; the new Dashboard page surfaces the top few items from each, with "View all →" links into them.

**No cofounder reference image exists for this screen** (unlike the learner dashboard). Visual treatment therefore follows the already-shipped `/org` page conventions (the plain bordered stat-card style already used in `org/reports/page.tsx` and the table style already used in `org/analytics/page.tsx`), not the colorful `StatTile`/sparkline treatment built for the learner dashboard — that treatment was chosen against a specific mockup this page doesn't have.

## Goals

- One page an org admin lands on that answers "is my org healthy" without clicking anywhere.
- Surface the org's CPD/compliance position — the domain-specific value HemoEdge has that a generic LMS dashboard doesn't (`cpd_points` is already real schema, not a mockup concept).
- Flag learners who need attention (inactive, overdue, or underperforming) before the admin has to go hunting in Analytics.
- **Scale correctly from a 2-learner org to a 10,000-learner org.** This is the binding constraint on the data layer (see below) — it rules out any approach that fetches full row sets into the Node process and aggregates in JavaScript.

## Non-goals

- Not rebuilding `/org/analytics` or `/org/reports` — they stay as-is.
- Not adding a generic "assign any content to any learner" feature — onboarding plans already cover assignment; this page only *surfaces* onboarding completion, it doesn't change how plans are built.
- Not supporting an org-configurable annual CPD target (e.g. "50 points/year") — deferred. This version measures earned-vs-available CPD purely from the org's own assigned/cataloged content, with no external or regulatory target baked in.
- Not a cross-org or super-admin view — this is `/org`, scoped to one org via `getCurrentOrg()`, same as every other page under this route.

## Data Layer: why SQL aggregation, not JS aggregation

`get-org-progress.ts` (used today by Analytics/Reports) fetches every member's every `quiz_attempts` row into the Node process and groups it in JavaScript. That's fine at the org sizes it's been used with so far, but this dashboard must work for orgs up to 10,000 learners, where that pattern means shipping potentially hundreds of thousands of rows over the wire per page load — too slow, and at some point simply too much memory.

This spec introduces a small number of **new Postgres functions** (`SECURITY DEFINER`, gated by the existing `is_org_admin(org_id)` helper, same authorization pattern already used by the `onboarding_*` RLS policies) that do the counting/averaging/summing inside Postgres and return only the small final result. This is additive — a new migration, no changes to existing tables, RLS policies, or the `get-org-progress.ts` path Analytics/Reports still use.

### `org_dashboard_kpis(p_org_id uuid)` → single row

| column | meaning |
|---|---|
| `learner_count` | `count(*)` of `organization_memberships` for the org |
| `seats_used` | same as `learner_count` (kept as a separate column so the app doesn't have to know they're currently identical) |
| `seats_total` | `organizations.seats` (nullable — `null` means unlimited) |
| `pass_rate_current` / `pass_rate_previous` | fraction of `quiz_attempts.passed` true, for org members, in the last 30 days vs. the 30 days before that — same current/previous-window shape `computePassRateTrend` (in `trend-math.ts`) already expects, so the trend arrow/label reuses that pure function and `formatPassRateTrendLabel` unchanged |
| `cpd_earned` | see CPD definition below |
| `cpd_available` | see CPD definition below |
| `certificates_issued` | `count(*)` of `certificates` for org members |

### `org_at_risk_learners(p_org_id uuid)` → one row per at-risk learner

Returns every org member who trips at least one of the three at-risk conditions below (bounded by org size — at most one row per member, so at most 10,000 rows even at max org size, safe to return in full and slice client-side for the top-5 display plus a total count from the row count). Columns: `user_id`, `name`, `email`, `last_activity_at` (nullable), `reasons` (array of `'inactive' | 'overdue_onboarding' | 'low_performance'`).

**At-risk conditions (a member matches if any apply):**
1. **Inactive** — no `quiz_attempts` and no `slide_views` row in the last 14 days, **and** the member's `organization_memberships.created_at` is more than 14 days ago (a grace period so a learner who joined 3 days ago isn't immediately flagged for having no activity yet — this grace period is a judgment call, not something you specified, flagged here for visibility).
2. **Overdue onboarding** — has an `onboarding_assignments` row with `due_date < today` where the assignment isn't fully complete (completion defined the same way as the Onboarding Completion section below: every item in the plan passed).
3. **Low performance** — average `quiz_attempts.score` below 70 across ≥3 total attempts, **or** ≥2 failed (`passed = false`) attempts on the same `module_id`/`case_id` quiz.

### `org_weakest_modules(p_org_id uuid, p_limit int)` → up to `p_limit` rows

Same shape as `get-org-progress.ts`'s existing `ModuleProgress` (`moduleId`, `title`, `attemptCount`, `averageScore`), computed with `GROUP BY module_id ... ORDER BY average_score ASC LIMIT p_limit` in SQL instead of fetched-then-sorted in JS.

### `org_onboarding_completion(p_org_id uuid)` → one row per active onboarding plan

Columns: `plan_id`, `name`, `assigned_count`, `completed_count`. An assignment counts as completed when every item in its plan is complete for that user — a module item is complete if the user has any `passed = true` attempt for that module; a curriculum item is complete if the user has a passed attempt for every module in that curriculum. (This reuses the existing `passed` boolean rather than re-deriving pass/fail from scores and thresholds, since that classification already exists on every attempt row.)

### CPD earned/available definition (org-wide)

Per your answer: HemoEdge-internal points, not an external/regulatory target, and no org-configurable annual target yet. Concretely:

- **Available** = sum of `cpd_points` across every module belonging to every published, `certificate_awarded = true` curriculum in the org's catalog (`org_catalog_selections`) — one number, the same for every learner in the org, computed once.
- **Earned** = sum, across all org members, of each member's own earned points against that *same full set* of curricula — i.e. for every module in every one of those curricula, if the member has a passed attempt, add that module's `cpd_points`.

This is intentionally broader than `certificate-progress.ts`'s existing `pickCertificateProgress`, which only reports the *single* curriculum closest to completion (right for one learner's progress ring, wrong for an org-wide compliance total — this dashboard wants the full picture, not one ring's worth).

## UI Structure (`/org/page.tsx` rewrite)

```
Org name + existing blurb (unchanged)

KPI row (5 cards, existing plain bordered-card style from org/reports/page.tsx):
  [Learners]  [Avg Pass Rate ↑/↓/flat]  [CPD Points earned/available]  [Certificates Issued]  [Seats used/total]

Two-column section (stacks on mobile):
  At-Risk Learners                       Weakest Modules
  - count + top 5, each showing which    - top 5, same table style as
    reason(s) triggered                    org/analytics/page.tsx today
  - "View all →" (see Open Question       - "View all →" org/analytics
    resolved below: links to /org/roster
    since Analytics doesn't have an
    at-risk view of its own)

Onboarding Completion (only rendered if the org has ≥1 active plan):
  - one row per plan: name, "N / M assigned complete", a progress bar
  - "View all →" /org/onboarding
```

**Empty/zero states:**
- No org (`getCurrentOrg()` returns null) — unchanged, same `ComingSoon` message already used by Analytics/Reports.
- Zero learners — KPI row still renders (Learners: 0, others show `—`/`0`), At-Risk and Weakest Modules sections show their existing "no data yet" empty rows (same pattern as Analytics' `"No quiz attempts yet."`/`"No learners yet."` rows).
- `seats_total` null (unlimited) — Seats card shows just the used count, no `/ total`.
- No active onboarding plans — the whole Onboarding Completion section is omitted, not shown empty.

## Testing & Verification Plan

- The three new SQL functions are the load-bearing logic this time (not pure TS, unlike sub-project C) — verified with direct SQL queries against the demo org's real data (same approach already used to verify `get-dashboard-trends.ts` live), checking each at-risk condition and the CPD sum by hand against known demo rows.
- Any TS-side formatting (trend label reuse, reason-badge text, empty-state branching) gets unit tests the same way `format-trend-label.ts` did.
- Live Playwright verification against the demo org admin account: KPI row renders with real numbers, at-risk list matches a hand-checked expectation, weakest-modules list matches Analytics' existing list for the same org, onboarding section renders or is correctly omitted, mobile layout has no horizontal overflow, light/dark both render correctly (same checklist as the learner dashboard's Task 8).

## Open Questions Resolved During Self-Review

- **"View all" target for At-Risk Learners:** Roster (`/org/roster`) rather than Analytics, since Analytics has no per-learner risk view today and Roster is the existing full-member list — sending admins there to look up a flagged name is the more natural fit than sending them to Analytics' score table, which doesn't surface risk reasons at all.
- **Where seats data lives:** confirmed `organizations.seats` (nullable integer) exists today in the schema; no separate `tier_id`-based seat cap was found, so `seats_total` reads directly from that column.
