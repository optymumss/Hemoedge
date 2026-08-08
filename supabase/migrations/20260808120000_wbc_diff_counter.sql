-- WBC differential counter: a spatial classification exercise. A Content
-- Manager drops a curated set of hotspot pins on a fixed view of a WSI
-- slide, each tagged with its correct cell_type. A learner then clicks
-- through the same pins, classifies each one, and gets scored against that
-- ground truth. Exercises can stand alone or hang off a module/case, mirrors
-- lessons/quiz_questions rather than reusing them (spatial classification is
-- a different shape than multiple-choice).

create table public.wbc_diff_exercises (
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

create index wbc_diff_exercises_slide_id_idx on public.wbc_diff_exercises (slide_id);
create index wbc_diff_exercises_module_id_idx on public.wbc_diff_exercises (module_id);
create index wbc_diff_exercises_case_id_idx on public.wbc_diff_exercises (case_id);
create index wbc_diff_exercises_created_by_idx on public.wbc_diff_exercises (created_by);

-- Ground-truth pins. x_pct/y_pct are normalized to the full source image
-- (0-1), independent of zoom/pan state or viewport pixel size.
create table public.wbc_diff_hotspots (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.wbc_diff_exercises (id) on delete cascade,
  cell_type_id uuid not null references public.cell_types (id),
  x_pct numeric not null check (x_pct >= 0 and x_pct <= 1),
  y_pct numeric not null check (y_pct >= 0 and y_pct <= 1),
  tolerance_pct numeric not null default 0.02,
  created_at timestamptz not null default now()
);

create index wbc_diff_hotspots_exercise_id_idx on public.wbc_diff_hotspots (exercise_id);
create index wbc_diff_hotspots_cell_type_id_idx on public.wbc_diff_hotspots (cell_type_id);

create table public.wbc_diff_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.wbc_diff_exercises (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  results jsonb not null,
  accuracy_pct numeric not null,
  created_at timestamptz not null default now()
);

create index wbc_diff_attempts_exercise_id_idx on public.wbc_diff_attempts (exercise_id);
create index wbc_diff_attempts_user_id_idx on public.wbc_diff_attempts (user_id);

alter table public.wbc_diff_exercises enable row level security;
alter table public.wbc_diff_hotspots enable row level security;
alter table public.wbc_diff_attempts enable row level security;

-- Exercises: same shape as slides/features/modules/cases/curricula's
-- draft/review/publish policies.
create policy "wbc_diff_exercises: super admin full access"
  on public.wbc_diff_exercises for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "wbc_diff_exercises: anyone can read published"
  on public.wbc_diff_exercises for select
  using (status = 'published');

create policy "wbc_diff_exercises: content manager can read own"
  on public.wbc_diff_exercises for select
  using (created_by = (select auth.uid()));

create policy "wbc_diff_exercises: content manager can create"
  on public.wbc_diff_exercises for insert
  with check (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager')
    and created_by = (select auth.uid())
    and status = 'draft'
  );

create policy "wbc_diff_exercises: content manager can edit their own draft or bounced work"
  on public.wbc_diff_exercises for update
  using (public.can_manage_content('wbc_diff_exercise', id, created_by) and status in ('draft', 'changes_requested'));

-- Hotspots: full CRUD for the owning content manager while authoring,
-- mirrors lessons' "manage their module's lessons" shape. Learners get
-- read access on published exercises too (needed to render the pins to
-- click) — cell_type_id (the answer) rides along with that grant exactly
-- like quiz_questions.correct_choice_id does; the learner-facing page only
-- selects the non-answer columns, and scoring re-fetches server-side.
create policy "wbc_diff_hotspots: super admin full access"
  on public.wbc_diff_hotspots for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

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

create policy "wbc_diff_hotspots: read for published exercises"
  on public.wbc_diff_hotspots for select
  using (
    exists (
      select 1 from public.wbc_diff_exercises
      where wbc_diff_exercises.id = wbc_diff_hotspots.exercise_id
        and wbc_diff_exercises.status = 'published'
    )
  );

-- Attempts: a learner can create and read their own; content staff can read
-- attempts on exercises they manage (to see how learners are doing).
create policy "wbc_diff_attempts: super admin full access"
  on public.wbc_diff_attempts for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "wbc_diff_attempts: learner can create their own"
  on public.wbc_diff_attempts for insert
  with check (user_id = (select auth.uid()));

create policy "wbc_diff_attempts: learner can read their own"
  on public.wbc_diff_attempts for select
  using (user_id = (select auth.uid()));

create policy "wbc_diff_attempts: content manager can read their exercise's attempts"
  on public.wbc_diff_attempts for select
  using (
    exists (
      select 1 from public.wbc_diff_exercises
      where wbc_diff_exercises.id = wbc_diff_attempts.exercise_id
        and wbc_diff_exercises.created_by = (select auth.uid())
    )
  );

-- Plug into the existing review workflow (Review Queue, submit-for-review).
alter table public.content_reviews drop constraint content_reviews_content_type_check;
alter table public.content_reviews add constraint content_reviews_content_type_check
  check (content_type in ('slide', 'feature', 'module', 'case', 'curriculum', 'wbc_diff_exercise'));
