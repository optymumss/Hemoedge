-- Performance advisor cleanup: two independent, low-risk optimizations.
--
-- 1. Add covering indexes for every unindexed foreign key (24 total) —
--    speeds up joins/cascades and lets FK checks use an index scan.
-- 2. Wrap bare auth.uid() calls in RLS policies with `(select auth.uid())`
--    so Postgres evaluates it once per statement (an initplan) instead of
--    once per row. Every policy below is re-created with identical logic,
--    just with that one rewrite — no access-control behavior changes.
--    Policies that only call is_super_admin()/is_org_admin() (which
--    already wrap their own auth.uid() internally) aren't touched; the
--    advisor doesn't flag those.

-- ── 1. Indexes ──────────────────────────────────────────────────────────

create index if not exists idx_audit_log_actor_id on public.audit_log (actor_id);
create index if not exists idx_cases_created_by on public.cases (created_by);
create index if not exists idx_certificates_curriculum_id on public.certificates (curriculum_id);
create index if not exists idx_content_reviews_reviewed_by on public.content_reviews (reviewed_by);
create index if not exists idx_content_reviews_submitted_by on public.content_reviews (submitted_by);
create index if not exists idx_curricula_created_by on public.curricula (created_by);
create index if not exists idx_curriculum_modules_module_id on public.curriculum_modules (module_id);
create index if not exists idx_features_cell_type_id on public.features (cell_type_id);
create index if not exists idx_features_created_by on public.features (created_by);
create index if not exists idx_impersonation_sessions_actor_id on public.impersonation_sessions (actor_id);
create index if not exists idx_impersonation_sessions_target_id on public.impersonation_sessions (target_id);
create index if not exists idx_modules_created_by on public.modules (created_by);
create index if not exists idx_org_catalog_selections_added_by on public.org_catalog_selections (added_by);
create index if not exists idx_organization_memberships_org_id on public.organization_memberships (org_id);
create index if not exists idx_organizations_tier_id on public.organizations (tier_id);
create index if not exists idx_quiz_attempts_case_id on public.quiz_attempts (case_id);
create index if not exists idx_quiz_attempts_module_id on public.quiz_attempts (module_id);
create index if not exists idx_quiz_attempts_user_id on public.quiz_attempts (user_id);
create index if not exists idx_quiz_questions_case_id on public.quiz_questions (case_id);
create index if not exists idx_quiz_questions_created_by on public.quiz_questions (created_by);
create index if not exists idx_quiz_questions_module_id on public.quiz_questions (module_id);
create index if not exists idx_slide_categories_parent_id on public.slide_categories (parent_id);
create index if not exists idx_slides_category_id on public.slides (category_id);
create index if not exists idx_slides_created_by on public.slides (created_by);

-- ── 2. RLS initplan rewrites ────────────────────────────────────────────

-- profiles
drop policy "profiles: self read" on public.profiles;
create policy "profiles: self read"
  on public.profiles for select
  using (id = (select auth.uid()));

drop policy "profiles: self update" on public.profiles;
create policy "profiles: self update"
  on public.profiles for update
  using (id = (select auth.uid()));

-- organizations
drop policy "organizations: members can view their own org" on public.organizations;
create policy "organizations: members can view their own org"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_memberships
      where organization_memberships.org_id = organizations.id
        and organization_memberships.user_id = (select auth.uid())
    )
  );

-- organization_memberships
drop policy "memberships: self read" on public.organization_memberships;
create policy "memberships: self read"
  on public.organization_memberships for select
  using (user_id = (select auth.uid()));

-- content_scopes
drop policy "content_scopes: self read" on public.content_scopes;
create policy "content_scopes: self read"
  on public.content_scopes for select
  using (content_manager_id = (select auth.uid()));

-- content_reviews
drop policy "content_reviews: submitter can read their own" on public.content_reviews;
create policy "content_reviews: submitter can read their own"
  on public.content_reviews for select
  using (submitted_by = (select auth.uid()));

-- org_catalog_selections
drop policy "org_catalog_selections: org members can view their org's picks" on public.org_catalog_selections;
create policy "org_catalog_selections: org members can view their org's picks"
  on public.org_catalog_selections for select
  using (
    exists (
      select 1 from public.organization_memberships
      where organization_memberships.org_id = org_catalog_selections.org_id
        and organization_memberships.user_id = (select auth.uid())
    )
  );

-- tiers
drop policy "tiers: authenticated read" on public.tiers;
create policy "tiers: authenticated read"
  on public.tiers for select
  using ((select auth.uid()) is not null);

-- quiz_attempts
drop policy "quiz_attempts: self insert" on public.quiz_attempts;
create policy "quiz_attempts: self insert"
  on public.quiz_attempts for insert
  with check (user_id = (select auth.uid()));

drop policy "quiz_attempts: self read" on public.quiz_attempts;
create policy "quiz_attempts: self read"
  on public.quiz_attempts for select
  using (user_id = (select auth.uid()));

-- certificates
drop policy "certificates: self insert" on public.certificates;
create policy "certificates: self insert"
  on public.certificates for insert
  with check (user_id = (select auth.uid()));

drop policy "certificates: self read" on public.certificates;
create policy "certificates: self read"
  on public.certificates for select
  using (user_id = (select auth.uid()));

-- quiz_questions
drop policy "quiz_questions: content manager can manage their content's questions" on public.quiz_questions;
create policy "quiz_questions: content manager can manage their content's questions"
  on public.quiz_questions for all
  using (
    (module_id is not null and exists (
      select 1 from public.modules where modules.id = quiz_questions.module_id and modules.created_by = (select auth.uid())
    ))
    or
    (case_id is not null and exists (
      select 1 from public.cases where cases.id = quiz_questions.case_id and cases.created_by = (select auth.uid())
    ))
  )
  with check (
    (module_id is not null and exists (
      select 1 from public.modules where modules.id = quiz_questions.module_id and modules.created_by = (select auth.uid())
    ))
    or
    (case_id is not null and exists (
      select 1 from public.cases where cases.id = quiz_questions.case_id and cases.created_by = (select auth.uid())
    ))
  );

-- audit_log
drop policy "audit_log: authenticated insert own actions" on public.audit_log;
create policy "audit_log: authenticated insert own actions"
  on public.audit_log for insert
  with check ((select auth.uid()) is not null and actor_id = (select auth.uid()));

-- impersonation_sessions
drop policy "impersonation_sessions: super admin manages their own" on public.impersonation_sessions;
create policy "impersonation_sessions: super admin manages their own"
  on public.impersonation_sessions for all
  using (public.is_super_admin() and actor_id = (select auth.uid()))
  with check (public.is_super_admin() and actor_id = (select auth.uid()));

-- Taxonomy tables share the same two-policy shape (slide_categories, cell_types).
do $$
declare
  t text;
begin
  foreach t in array array['slide_categories', 'cell_types']
  loop
    execute format($f$
      drop policy "taxonomy: authenticated read (%1$s)" on public.%1$s;
      create policy "taxonomy: authenticated read (%1$s)"
        on public.%1$s for select
        using ((select auth.uid()) is not null);
    $f$, t);

    execute format($f$
      drop policy "taxonomy: content staff write (%1$s)" on public.%1$s;
      create policy "taxonomy: content staff write (%1$s)"
        on public.%1$s for all
        using (
          public.is_super_admin()
          or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'content_manager')
        )
        with check (
          public.is_super_admin()
          or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'content_manager')
        );
    $f$, t);
  end loop;
end $$;

-- curriculum_modules has the same shape, one-off naming.
drop policy "curriculum_modules: authenticated read" on public.curriculum_modules;
create policy "curriculum_modules: authenticated read"
  on public.curriculum_modules for select
  using ((select auth.uid()) is not null);

drop policy "curriculum_modules: content staff write" on public.curriculum_modules;
create policy "curriculum_modules: content staff write"
  on public.curriculum_modules for all
  using (
    public.is_super_admin()
    or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'content_manager')
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'content_manager')
  );

-- Authored content tables share the "read own" + "create" shape.
do $$
declare
  t text;
begin
  foreach t in array array['slides', 'features', 'modules', 'cases', 'curricula']
  loop
    execute format($f$
      drop policy "%1$s: content manager can read own" on public.%1$s;
      create policy "%1$s: content manager can read own"
        on public.%1$s for select
        using (created_by = (select auth.uid()));
    $f$, t);

    execute format($f$
      drop policy "%1$s: content manager can create" on public.%1$s;
      create policy "%1$s: content manager can create"
        on public.%1$s for insert
        with check (
          exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'content_manager')
          and created_by = (select auth.uid())
          and status = 'draft'
        );
    $f$, t);
  end loop;
end $$;
