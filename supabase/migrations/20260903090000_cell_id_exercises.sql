-- Pinned WSI cell identification: a spatial classification exercise, kept
-- deliberately separate from the Manual Diff Counter (differential
-- counting practice) per the "Abnormal Cell Recognition" competency —
-- learners click through a curated set of pins and identify each cell,
-- scored against ground truth. Same shape as the Manual Diff Counter's
-- exercises/hotspots/attempts before that content type was redesigned into
-- a reference-differential counter.
create table public.cell_id_exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.content_level not null,
  status public.content_status not null default 'draft',
  slide_id uuid not null references public.slides (id),
  module_id uuid references public.modules (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  instructions text,
  cpd_points integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cell_id_exercises_slide_id_idx on public.cell_id_exercises (slide_id);
create index cell_id_exercises_module_id_idx on public.cell_id_exercises (module_id);
create index cell_id_exercises_case_id_idx on public.cell_id_exercises (case_id);
create index cell_id_exercises_created_by_idx on public.cell_id_exercises (created_by);

-- Ground-truth pins. x_pct/y_pct are normalized to the full source image
-- (0-1), independent of zoom/pan state or viewport pixel size. Not limited
-- to WBC-diff-countable cell types — this exercise spans any lineage
-- (abnormal RBC forms, parasites, blasts, atypical lymphocytes, etc).
create table public.cell_id_hotspots (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.cell_id_exercises (id) on delete cascade,
  cell_type_id uuid not null references public.cell_types (id),
  x_pct numeric not null check (x_pct >= 0 and x_pct <= 1),
  y_pct numeric not null check (y_pct >= 0 and y_pct <= 1),
  tolerance_pct numeric not null default 0.02,
  created_at timestamptz not null default now()
);

create index cell_id_hotspots_exercise_id_idx on public.cell_id_hotspots (exercise_id);
create index cell_id_hotspots_cell_type_id_idx on public.cell_id_hotspots (cell_type_id);

create table public.cell_id_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.cell_id_exercises (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  results jsonb not null,
  accuracy_pct numeric not null,
  created_at timestamptz not null default now()
);

create index cell_id_attempts_exercise_id_idx on public.cell_id_attempts (exercise_id);
create index cell_id_attempts_user_id_idx on public.cell_id_attempts (user_id);

alter table public.cell_id_exercises enable row level security;
alter table public.cell_id_hotspots enable row level security;
alter table public.cell_id_attempts enable row level security;

create policy "cell_id_exercises: super admin full access"
  on public.cell_id_exercises for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "cell_id_exercises: anyone can read published"
  on public.cell_id_exercises for select
  using (status = 'published');

create policy "cell_id_exercises: content manager can read own"
  on public.cell_id_exercises for select
  using (created_by = (select auth.uid()));

create policy "cell_id_exercises: content manager can create"
  on public.cell_id_exercises for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager')
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy "cell_id_exercises: content manager can edit their own draft or bounced work"
  on public.cell_id_exercises for update
  using (public.can_manage_content('cell_id_exercise', id, created_by) and status in ('draft', 'changes_requested'));

create policy "cell_id_hotspots: super admin full access"
  on public.cell_id_hotspots for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "cell_id_hotspots: content manager can manage their exercise's hotspots"
  on public.cell_id_hotspots for all
  using (
    exists (
      select 1 from public.cell_id_exercises
      where cell_id_exercises.id = cell_id_hotspots.exercise_id
        and cell_id_exercises.created_by = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.cell_id_exercises
      where cell_id_exercises.id = cell_id_hotspots.exercise_id
        and cell_id_exercises.created_by = (select auth.uid())
    )
  );

create policy "cell_id_hotspots: read for published exercises"
  on public.cell_id_hotspots for select
  using (
    exists (
      select 1 from public.cell_id_exercises
      where cell_id_exercises.id = cell_id_hotspots.exercise_id
        and cell_id_exercises.status = 'published'
    )
  );

create policy "cell_id_attempts: super admin full access"
  on public.cell_id_attempts for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "cell_id_attempts: learner can create their own"
  on public.cell_id_attempts for insert
  with check (user_id = (select auth.uid()));

create policy "cell_id_attempts: learner can read their own"
  on public.cell_id_attempts for select
  using (user_id = (select auth.uid()));

create policy "cell_id_attempts: content manager can read their exercise's attempts"
  on public.cell_id_attempts for select
  using (
    exists (
      select 1 from public.cell_id_exercises
      where cell_id_exercises.id = cell_id_attempts.exercise_id
        and cell_id_exercises.created_by = (select auth.uid())
    )
  );

alter table public.content_reviews drop constraint content_reviews_content_type_check;
alter table public.content_reviews add constraint content_reviews_content_type_check
  check (content_type in ('slide', 'feature', 'module', 'case', 'curriculum', 'wbc_diff_exercise', 'cell_id_exercise'));
