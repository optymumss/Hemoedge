-- Progress tracking: which modules make up a curriculum, module quizzes,
-- learner attempts, and certificates issued on passing every module in a
-- curriculum at or above its pass threshold.
--
-- Scope note: module quizzes only for now (case quizzes are a natural
-- follow-up, not needed to unblock Competency Pathway/Certificates).

create table public.curriculum_modules (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  position integer not null default 0,
  unique (curriculum_id, module_id)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  question_text text not null,
  choices jsonb not null,
  correct_choice_id text not null,
  position integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  verification_code text not null unique,
  issued_at timestamptz not null default now(),
  unique (user_id, curriculum_id)
);

alter table public.curriculum_modules enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;

-- curriculum_modules: authored by content staff, readable by anyone signed in.
create policy "curriculum_modules: content staff write"
  on public.curriculum_modules for all
  using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'))
  with check (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'));

create policy "curriculum_modules: authenticated read"
  on public.curriculum_modules for select
  using (auth.uid() is not null);

-- quiz_questions: content staff manage; learners can read questions for a
-- published module (needed to render the quiz), but never see other users'
-- data. Correct answers are still scored server-side and stripped before
-- reaching the client regardless of this read grant.
create policy "quiz_questions: super admin full access"
  on public.quiz_questions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "quiz_questions: content manager can manage their module's questions"
  on public.quiz_questions for all
  using (
    exists (
      select 1 from public.modules
      where modules.id = quiz_questions.module_id and modules.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.modules
      where modules.id = quiz_questions.module_id and modules.created_by = auth.uid()
    )
  );

create policy "quiz_questions: read for published modules"
  on public.quiz_questions for select
  using (
    exists (
      select 1 from public.modules
      where modules.id = quiz_questions.module_id and modules.status = 'published'
    )
  );

-- quiz_attempts: a learner owns their attempts; org admins see their org's
-- members' attempts (for analytics); super admin sees everything.
create policy "quiz_attempts: self insert"
  on public.quiz_attempts for insert
  with check (user_id = auth.uid());

create policy "quiz_attempts: self read"
  on public.quiz_attempts for select
  using (user_id = auth.uid());

create policy "quiz_attempts: org admin reads their org's attempts"
  on public.quiz_attempts for select
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.user_id = quiz_attempts.user_id
        and public.is_org_admin(om.org_id)
    )
  );

create policy "quiz_attempts: super admin full access"
  on public.quiz_attempts for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- certificates: same visibility shape as attempts.
create policy "certificates: self insert"
  on public.certificates for insert
  with check (user_id = auth.uid());

create policy "certificates: self read"
  on public.certificates for select
  using (user_id = auth.uid());

create policy "certificates: org admin reads their org's certificates"
  on public.certificates for select
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.user_id = certificates.user_id
        and public.is_org_admin(om.org_id)
    )
  );

create policy "certificates: super admin full access"
  on public.certificates for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
