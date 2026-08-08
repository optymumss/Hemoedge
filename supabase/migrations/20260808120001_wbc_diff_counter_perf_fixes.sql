-- Follow-up to wbc_diff_counter: adds the two missing FK covering indexes
-- and wraps auth.uid() in (select ...) per the RLS initplan optimization
-- already applied elsewhere (module_expanded_fields etc). Kept as its own
-- migration since it was applied as a correction after the base migration
-- was already live; a fresh install runs both as harmless no-ops on top of
-- the already-corrected base file.

create index if not exists wbc_diff_exercises_created_by_idx on public.wbc_diff_exercises (created_by);
create index if not exists wbc_diff_hotspots_cell_type_id_idx on public.wbc_diff_hotspots (cell_type_id);

drop policy "wbc_diff_exercises: content manager can read own" on public.wbc_diff_exercises;
create policy "wbc_diff_exercises: content manager can read own"
  on public.wbc_diff_exercises for select
  using (created_by = (select auth.uid()));

drop policy "wbc_diff_exercises: content manager can create" on public.wbc_diff_exercises;
create policy "wbc_diff_exercises: content manager can create"
  on public.wbc_diff_exercises for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager')
    and created_by = (select auth.uid())
    and status = 'draft'
  );

drop policy "wbc_diff_hotspots: content manager can manage their exercise's hotspots" on public.wbc_diff_hotspots;
create policy "wbc_diff_hotspots: content manager can manage their exercise's hotspots"
  on public.wbc_diff_hotspots for all
  using (
    exists (
      select 1 from public.wbc_diff_exercises
      where wbc_diff_exercises.id = wbc_diff_hotspots.exercise_id
        and wbc_diff_exercises.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.wbc_diff_exercises
      where wbc_diff_exercises.id = wbc_diff_hotspots.exercise_id
        and wbc_diff_exercises.created_by = (select auth.uid())
    )
  );

drop policy "wbc_diff_attempts: learner can create their own" on public.wbc_diff_attempts;
create policy "wbc_diff_attempts: learner can create their own"
  on public.wbc_diff_attempts for insert
  with check (user_id = (select auth.uid()));

drop policy "wbc_diff_attempts: learner can read their own" on public.wbc_diff_attempts;
create policy "wbc_diff_attempts: learner can read their own"
  on public.wbc_diff_attempts for select
  using (user_id = (select auth.uid()));

drop policy "wbc_diff_attempts: content manager can read their exercise's attempts" on public.wbc_diff_attempts;
create policy "wbc_diff_attempts: content manager can read their exercise's attempts"
  on public.wbc_diff_attempts for select
  using (
    exists (
      select 1 from public.wbc_diff_exercises
      where wbc_diff_exercises.id = wbc_diff_attempts.exercise_id
        and wbc_diff_exercises.created_by = (select auth.uid())
    )
  );
