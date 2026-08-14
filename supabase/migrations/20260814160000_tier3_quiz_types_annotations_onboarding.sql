-- Quiz engine: question types beyond single-choice MCQ
alter table public.quiz_questions
  add column question_type text not null default 'single_choice',
  add column correct_choice_ids jsonb;

alter table public.quiz_questions
  add constraint quiz_questions_question_type_check
  check (question_type in ('single_choice', 'true_false', 'multi_select', 'image_match', 'short_answer'));

-- Short-answer questions can't be auto-scored; an attempt containing one sits
-- pending_manual_grading until a reviewer grades it, then score is recomputed.
alter table public.quiz_attempts
  add column pending_manual_grading boolean not null default false,
  add column manual_grades jsonb;

-- Slide annotations: a teaching-mode overlay that belongs to the slide
-- itself, so it shows up wherever that slide is embedded (case study,
-- lesson, standalone) rather than being tied to one specific context.
create table public.slide_annotations (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides(id) on delete cascade,
  x_pct numeric not null check (x_pct >= 0 and x_pct <= 1),
  y_pct numeric not null check (y_pct >= 0 and y_pct <= 1),
  label text not null,
  body text,
  position integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.slide_annotations enable row level security;
create index slide_annotations_slide_id_idx on public.slide_annotations(slide_id);

-- Onboarding plans: an org admin builds a named, ordered plan of pathways
-- and/or modules once, then assigns it to specific roster members with an
-- optional due date. Progress is derived from existing quiz_attempts /
-- curriculum_modules data, not tracked separately. All three tables are
-- created before any policy so the policies below can reference each other.
create table public.onboarding_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.onboarding_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.onboarding_plans(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete cascade,
  position integer not null default 0,
  constraint onboarding_plan_items_one_target check (
    (module_id is not null and curriculum_id is null) or
    (module_id is null and curriculum_id is not null)
  )
);

create table public.onboarding_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.onboarding_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  due_date date,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (plan_id, user_id)
);

alter table public.onboarding_plans enable row level security;
alter table public.onboarding_plan_items enable row level security;
alter table public.onboarding_assignments enable row level security;

create index onboarding_plans_org_id_idx on public.onboarding_plans(org_id);
create index onboarding_plan_items_plan_id_idx on public.onboarding_plan_items(plan_id);
create index onboarding_plan_items_module_id_idx on public.onboarding_plan_items(module_id);
create index onboarding_plan_items_curriculum_id_idx on public.onboarding_plan_items(curriculum_id);
create index onboarding_assignments_plan_id_idx on public.onboarding_assignments(plan_id);
create index onboarding_assignments_user_id_idx on public.onboarding_assignments(user_id);

create policy "slide_annotations: content manager can manage their slide's annotations"
  on public.slide_annotations for all
  using (exists (select 1 from public.slides where slides.id = slide_annotations.slide_id and slides.created_by = (select auth.uid())))
  with check (exists (select 1 from public.slides where slides.id = slide_annotations.slide_id and slides.created_by = (select auth.uid())));

create policy "slide_annotations: read for published slides"
  on public.slide_annotations for select
  using (exists (select 1 from public.slides where slides.id = slide_annotations.slide_id and slides.status = 'published'));

create policy "slide_annotations: super admin full access"
  on public.slide_annotations for all
  using (is_super_admin())
  with check (is_super_admin());

create policy "onboarding_plans: org admin can manage their org's plans"
  on public.onboarding_plans for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

create policy "onboarding_plans: assigned learner can read"
  on public.onboarding_plans for select
  using (exists (
    select 1 from public.onboarding_assignments
    where onboarding_assignments.plan_id = onboarding_plans.id
      and onboarding_assignments.user_id = (select auth.uid())
  ));

create policy "onboarding_plans: super admin full access"
  on public.onboarding_plans for all
  using (is_super_admin())
  with check (is_super_admin());

create policy "onboarding_plan_items: org admin can manage their org's plan items"
  on public.onboarding_plan_items for all
  using (exists (
    select 1 from public.onboarding_plans
    where onboarding_plans.id = onboarding_plan_items.plan_id
      and is_org_admin(onboarding_plans.org_id)
  ))
  with check (exists (
    select 1 from public.onboarding_plans
    where onboarding_plans.id = onboarding_plan_items.plan_id
      and is_org_admin(onboarding_plans.org_id)
  ));

create policy "onboarding_plan_items: assigned learner can read"
  on public.onboarding_plan_items for select
  using (exists (
    select 1 from public.onboarding_assignments
    where onboarding_assignments.plan_id = onboarding_plan_items.plan_id
      and onboarding_assignments.user_id = (select auth.uid())
  ));

create policy "onboarding_plan_items: super admin full access"
  on public.onboarding_plan_items for all
  using (is_super_admin())
  with check (is_super_admin());

create policy "onboarding_assignments: org admin can manage their org's assignments"
  on public.onboarding_assignments for all
  using (exists (
    select 1 from public.onboarding_plans
    where onboarding_plans.id = onboarding_assignments.plan_id
      and is_org_admin(onboarding_plans.org_id)
  ))
  with check (exists (
    select 1 from public.onboarding_plans
    where onboarding_plans.id = onboarding_assignments.plan_id
      and is_org_admin(onboarding_plans.org_id)
  ));

create policy "onboarding_assignments: learner can read their own"
  on public.onboarding_assignments for select
  using (user_id = (select auth.uid()));

create policy "onboarding_assignments: super admin full access"
  on public.onboarding_assignments for all
  using (is_super_admin())
  with check (is_super_admin());
