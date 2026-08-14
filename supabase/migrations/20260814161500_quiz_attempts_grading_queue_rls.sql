-- quiz_attempts had no UPDATE policy at all (only super_admin's blanket ALL)
-- and no SELECT for content managers, so the grading queue couldn't work for
-- anyone but a super admin. Scoped narrowly to attempts actually awaiting
-- grading, not general attempt access.
create policy "quiz_attempts: content staff can read pending grading"
  on public.quiz_attempts for select
  using (
    pending_manual_grading
    and (is_super_admin() or exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager'
    ))
  );

create policy "quiz_attempts: content staff can grade pending attempts"
  on public.quiz_attempts for update
  using (
    pending_manual_grading
    and (is_super_admin() or exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager'
    ))
  )
  with check (
    is_super_admin() or exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager'
    )
  );
