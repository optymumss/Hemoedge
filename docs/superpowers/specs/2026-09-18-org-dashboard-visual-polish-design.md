# Org Dashboard Visual Polish — Design Spec

## Overview

The org admin dashboard (`/org/page.tsx`, shipped in PR #56) currently uses the plain bordered-card/table style already established on `/org/analytics` and `/org/reports`. This spec is a follow-up visual-polish pass: restyle the same four sections (KPI strip, At-Risk Learners, Weakest Modules, Onboarding Completion) toward the richer look shown in two reference images the user provided (a dark "Solis" analytics dashboard and a component sheet with charts/rings/calendar), **and** add one new section — a hero headline card.

**Unlike the original org-dashboard spec, a visual reference exists this time.** The references use a green/lime accent; every color in this spec instead maps onto HemoEdge's existing wine/maroon design tokens already defined in `globals.css` (`--accent`, `--accent-soft`, `--danger`/`--warning`/`--success`/`--info` and their `-soft`/`-soft-ink` pairs) so the page repaints correctly between light and dark themes automatically, the same way every other page in the app does. No new hardcoded colors, and no adoption of components that don't fit the org dashboard's actual data (the reference's world map and calendar are explicitly out of scope — no per-country or scheduling data exists to back them).

Confirmed with the user via mockup screenshots before writing this spec: the hero card treatment, and KPI-card style "A" (accent-left-border card with a colored trend pill) over style "B" (card with an inline sparkline).

## Goals

- Full visual overhaul of the four existing sections — richer cards, colored status badges/bars, better visual hierarchy — while keeping every section's *content* unchanged (same KPIs, same at-risk criteria, same weakest-modules list, same onboarding rollup from PR #56).
- Add one new **hero headline card**: a full-width card above the KPI row stating whether the org's overall activity is trending up or down over the last 30 days, with an area-chart visualization.
- Everything must work in both light and dark themes using existing tokens, and remain responsive (no mobile horizontal overflow), matching the verification bar already established for every other dashboard page this engagement.

## Non-goals

- No world map, calendar, or "AI-generated report" CTA tile — none of these have backing data or an existing feature to link to.
- No change to at-risk criteria, KPI definitions, weakest-modules logic, or onboarding-completion logic from PR #56 — this pass is presentation only, except for the one new hero-card data source described below.
- No radial/donut progress rings for CPD or onboarding (user explicitly declined this option) — CPD stays a plain "earned / available" stat, onboarding stays a linear progress bar (restyled, not restructured).
- Not touching `/org/analytics`, `/org/reports`, or any other `/org` page — scope is `/org/page.tsx` only, same boundary as the original org-dashboard spec.

## New Data: Hero Headline Card

The hero card needs a genuinely new data source: a day-by-day activity count over the last 60 days (current 30-day window vs. previous 30), so it can reuse the existing trend-formatting pattern (`formatCountTrendLabel`) and render an area chart from a sparkline-shaped array — the same visual language the learner dashboard's stat tiles already established.

**Activity = `quiz_attempts` + `slide_views` combined**, counted per calendar day, across every member of the org. Same scale constraint as the rest of the org dashboard: orgs range from 2 to 10,000 learners, so this must be computed as 60 pre-aggregated daily counts in Postgres — never by fetching raw event timestamps into Node (that's the exact pattern the original org-dashboard spec ruled out, and it applies here even more directly, since 10,000 learners' worth of 60 days of quiz/slide events could be an enormous row count to ship over the wire).

- **New SQL function**: `org_daily_activity_counts(p_org_id uuid)` → 60 rows, each `{ day_offset: integer, event_count: integer }` — the count of `quiz_attempts` plus `slide_views` from that org's members on that calendar day. `day_offset` runs 0 to 59 where **0 is the oldest day (59 days ago) and 59 is today** — rows ordered by `day_offset` ascending, so the array the caller receives is already oldest-to-newest, matching the ordering `buildSparkline`'s output already uses elsewhere in this codebase. Gated by `is_org_admin(p_org_id)` like every other function in this feature.
- **New pure function** in `src/lib/trends/trend-math.ts` (extending it, not duplicating — same pattern sub-project C used to add `PassRateTrend` alongside the original `TrendDelta`/`TrendWithSparkline`): `buildTrendFromDailyCounts(dailyCounts: number[], now: Date): TrendWithSparkline`, taking the 60 ordered daily counts (the shape the SQL function returns), splitting them into the previous-30/current-30 windows, and building the same `TrendWithSparkline` shape `buildTrend` produces from raw timestamps — just from pre-aggregated counts instead. This is a new function rather than a reuse of `buildTrend` because `buildTrend` takes raw `Date[]` timestamps, which is exactly the shape this spec's scale constraint rules out fetching.
- **New wrapper** in `src/lib/org/get-org-dashboard.ts`: `getOrgActivityTrend(supabase, orgId): Promise<TrendWithSparkline>`, calling the new RPC and feeding its result through `buildTrendFromDailyCounts`. Same exception-safety convention as the other four wrapper functions (catches its own errors, returns `flatTrend()` on failure).
- **New pure headline formatter** in `src/lib/org/format-org-dashboard.ts` (extending the file from PR #56): `formatActivityHeadline(trend: TrendDelta): string`, producing the hero card's sentence. `formatCountTrendLabel` (existing) produces short badge text like "+25% vs last month" — the hero card needs a full sentence instead, so this is a distinct function with its own cases:
  - Percent change positive → `"Your team's engagement is up {N}% this month."`
  - Percent change negative → `"Your team's engagement is down {N}% this month."` (using the absolute value)
  - Percent change exactly zero (both periods non-zero and equal) → `"Your team's engagement is flat this month."`
  - No prior baseline but current activity exists → `"Your team has new activity this month."`
  - No activity in either period → `"Your team hasn't had any activity in the last 30 days."`

## Visual Design

### Hero headline card

Full width, positioned between the existing header text and the KPI row. Background is a subtle diagonal tint from `--surface-raised` toward `--accent-soft` (both already theme-aware — this is not a new hardcoded color, just a CSS gradient between two existing tokens, so it adapts automatically between light and dark). Contains: a small "Last 30 days vs. previous 30" caption, the headline sentence from `formatActivityHeadline` (with the percentage itself in `--accent`), and an area chart built from `trend.sparkline.points` — the SVG stroke and fill must reference the `--accent` token (e.g. Tailwind's `stroke-accent`/`fill-accent` utilities), not a hardcoded hex, so the chart repaints correctly in dark mode the same way the rest of the app does. A "View Analytics →" link at the bottom-left points to `/org/analytics`.

### KPI row (style A — confirmed)

All 5 existing cards (Learners, Avg Quiz Pass Rate, CPD Points, Certificates Issued, Seats) get: a 3px left border in `--accent`, the existing uppercase label, the existing large value. The Avg Quiz Pass Rate card's trend label changes from plain text to a colored pill: **the pill's color reflects trend direction using the existing semantic status tokens, not the accent** (`--success-soft`/`--success-soft-ink` for "up", `--danger-soft`/`--danger-soft-ink` for "down", `--surface-sunken`/`--ink-dim` for "flat"/no data) — this keeps the accent meaning "brand" and status colors meaning "good/bad," exactly the separation `globals.css`'s own header comment already establishes for the rest of the app. (An earlier mockup used the accent-soft token for this pill by mistake; this is corrected here.)

### At-Risk Learners

Each row gets a small severity dot before the name, colored by the worst reason present: `--danger` if `low_performance` is among the reasons, else `--info` if `overdue_onboarding` is present, else `--warning`. Each reason becomes a small colored badge instead of comma-separated plain text, using the matching semantic `-soft`/`-soft-ink` pair: `inactive` → warning tokens, `overdue_onboarding` → info tokens, `low_performance` → danger tokens.

### Weakest Modules

Each row's score becomes a small horizontal bar plus the existing percentage text, colored by the same threshold logic already partially present in PR #56 (score < 70 shown differently), extended to three tiers: `--danger` below 70, `--warning` from 70–89, `--success` at 90 and above.

### Onboarding Completion

Same linear progress bar as PR #56, restyled to use a solid `--accent` fill (matching the existing pattern already used elsewhere in the app, e.g. the Continue Learning progress bar on the learner dashboard) — not a custom gradient blend, since mixing token values into a bespoke gradient would stop adapting correctly between themes.

## Testing & Verification Plan

- New pure functions (`buildTrendFromDailyCounts`, `formatActivityHeadline`, and any small color-mapping helpers for the severity dot / reason badges / score-bar tiers) get Vitest unit tests, same convention as every prior pure-logic task this engagement.
- `org_daily_activity_counts` gets verified the same way the four PR #56 functions were: direct SQL against the real demo org, cross-checked against an independent query, then a live RPC call through the app's real Supabase client as the demo org admin.
- Final live Playwright verification explicitly covers **both** light and dark themes for every restyled section (not just dark, since this pass is specifically about visual polish and the reference images were dark-only) plus mobile — same checklist shape as every prior dashboard verification task this engagement (no horizontal overflow, all links still resolve, empty/zero states still render correctly: zero organization-wide activity ever should show the "hasn't had any activity" hero sentence and a flat/empty sparkline, not an error).
