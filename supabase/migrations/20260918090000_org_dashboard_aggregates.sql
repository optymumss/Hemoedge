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
