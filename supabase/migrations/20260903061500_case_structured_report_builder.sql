-- Answer-key fields for the structured report builder — a content
-- manager defines the expected findings per morphology section and the
-- must-not-miss critical findings for a case, alongside the
-- escalation_decision/suggested_report_comment/learning_points fields
-- that already exist. AI grading compares a learner's submission against
-- these case-specific fields, not general knowledge.
alter table public.cases
  add column expected_rbc_findings text,
  add column expected_wbc_findings text,
  add column expected_platelet_findings text,
  add column expected_abnormal_findings text,
  add column critical_findings text;

-- A learner's structured 7-section report attempt for a case, graded by
-- AI against the case's answer key above. Multiple attempts are allowed
-- (same convention as quiz_attempts/wbc_diff_attempts) — the case page
-- shows the most recent.
create table public.case_report_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rbc_morphology text not null,
  wbc_morphology text not null,
  platelet_morphology text not null,
  abnormal_findings text not null,
  overall_interpretation text not null,
  escalation_decision text not null check (escalation_decision in ('routine', 'senior_review', 'urgent')),
  report_comment text not null,
  ai_score integer not null check (ai_score between 0 and 100),
  ai_missed_findings jsonb not null default '[]'::jsonb,
  ai_feedback text not null,
  escalation_correct boolean not null,
  created_at timestamptz not null default now()
);

create index case_report_submissions_case_id_idx on public.case_report_submissions(case_id);
create index case_report_submissions_user_id_idx on public.case_report_submissions(user_id);

alter table public.case_report_submissions enable row level security;

create policy "case_report_submissions: learner can insert own"
  on public.case_report_submissions for insert
  with check (user_id = (select auth.uid()));

create policy "case_report_submissions: learner can read own"
  on public.case_report_submissions for select
  using (user_id = (select auth.uid()));

create policy "case_report_submissions: super admin full access"
  on public.case_report_submissions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
