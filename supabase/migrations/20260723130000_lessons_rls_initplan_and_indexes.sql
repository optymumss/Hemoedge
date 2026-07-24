-- Advisor follow-up for the lessons table: cover the two foreign keys with
-- indexes, and rewrite the content-manager policy to call auth.uid() once
-- per statement instead of once per row (same fix already applied to the
-- other content tables in 20260718000000_performance_indexes_and_rls_initplan.sql).

create index if not exists idx_lessons_created_by on public.lessons (created_by);
create index if not exists idx_lessons_slide_id on public.lessons (slide_id);

drop policy "lessons: content manager can manage their module's lessons" on public.lessons;
create policy "lessons: content manager can manage their module's lessons"
  on public.lessons for all
  using (
    exists (
      select 1 from public.modules
      where modules.id = lessons.module_id and modules.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.modules
      where modules.id = lessons.module_id and modules.created_by = (select auth.uid())
    )
  );
