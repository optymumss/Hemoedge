-- The Manual Diff Counter practice exercise no longer scores against
-- ground-truth hotspot pins (wbc_diff_hotspots) — a learner free-tallies
-- the whole slide, same as the practice counter in a case/module, and is
-- scored against a reference differential the admin sets for the slide
-- instead. Shape: { NEUT: 62, LYMPH: 24, ..., NRBC: 2 } — percentages for
-- the 9 WBC categories (summing to ~100) plus NRBC as a count per 100 WBCs,
-- matching the categories in src/lib/wbc-categories.ts. Nullable: an
-- exercise isn't practice-ready until an admin sets this.
alter table public.wbc_diff_exercises
  add column reference_differential jsonb;
