-- Case Study: category, escalation decision, suggested report comment (Subra review point 9)
alter table public.cases
  add column case_category text,
  add column escalation_decision text,
  add column suggested_report_comment text;

alter table public.cases
  add constraint cases_escalation_decision_check
  check (escalation_decision is null or escalation_decision in ('routine', 'senior_review', 'urgent'));

-- Quiz questions: model answer (Subra review point 9) + optional feature tag (dashboard weak-areas)
alter table public.quiz_questions
  add column model_answer text,
  add column feature_id uuid references public.features(id) on delete set null;

create index quiz_questions_feature_id_idx on public.quiz_questions(feature_id);

-- Case Study: related modules (Subra review point 9 "Related Modules")
create table public.case_modules (
  case_id uuid not null references public.cases(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  primary key (case_id, module_id)
);

alter table public.case_modules enable row level security;

create index case_modules_module_id_idx on public.case_modules(module_id);

create policy "case_modules: content manager can manage their case's modules"
  on public.case_modules for all
  using (exists (select 1 from public.cases where cases.id = case_modules.case_id and cases.created_by = (select auth.uid())))
  with check (exists (select 1 from public.cases where cases.id = case_modules.case_id and cases.created_by = (select auth.uid())));

create policy "case_modules: read for published cases"
  on public.case_modules for select
  using (exists (select 1 from public.cases where cases.id = case_modules.case_id and cases.status = 'published'));

create policy "case_modules: super admin full access"
  on public.case_modules for all
  using (is_super_admin())
  with check (is_super_admin());

-- Case Study: additional WSI slides beyond the existing primary slide_id (Subra review point 9 "Attached WSI Slides")
create table public.case_slides (
  case_id uuid not null references public.cases(id) on delete cascade,
  slide_id uuid not null references public.slides(id) on delete cascade,
  primary key (case_id, slide_id)
);

alter table public.case_slides enable row level security;

create index case_slides_slide_id_idx on public.case_slides(slide_id);

create policy "case_slides: content manager can manage their case's slides"
  on public.case_slides for all
  using (exists (select 1 from public.cases where cases.id = case_slides.case_id and cases.created_by = (select auth.uid())))
  with check (exists (select 1 from public.cases where cases.id = case_slides.case_id and cases.created_by = (select auth.uid())));

create policy "case_slides: read for published cases"
  on public.case_slides for select
  using (exists (select 1 from public.cases where cases.id = case_slides.case_id and cases.status = 'published'));

create policy "case_slides: super admin full access"
  on public.case_slides for all
  using (is_super_admin())
  with check (is_super_admin());

-- Cell types: decouple the WBC diff counter from the full taxonomy (Subra review point 2) —
-- only cell types flagged countable show up as options in the manual differential counter,
-- instead of every white_cell-lineage entry (which will keep growing as the Feature Library does).
alter table public.cell_types
  add column is_wbc_diff_countable boolean not null default false;

update public.cell_types
  set is_wbc_diff_countable = true
  where code in ('NEUTR', 'LYMPH', 'MONOC', 'EOSIN', 'BASOP');

-- Learning Pathways: versioning (build notes item 8) — "Publish new version" duplicates a
-- published pathway into a new draft row linked back via previous_version_id, so the original
-- stays intact (and visible/passable) for learners already partway through it.
alter table public.curricula
  add column previous_version_id uuid references public.curricula(id) on delete set null;

create index curricula_previous_version_id_idx on public.curricula(previous_version_id);
