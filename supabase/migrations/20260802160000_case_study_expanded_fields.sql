-- Cases had no way to attach a WSI slide at all — the "heart of the
-- product" per the stakeholder build notes (WSI case viewer) — and only
-- Title, Level, and Description otherwise. Adds a primary slide, clinical
-- fields (case context, lab values, final diagnosis, learning points),
-- estimated time, and CPD points, mirroring the Modules expansion. Also
-- adds case_tags (reusing the shared tags table from Modules) and
-- case_features, a bidirectional link so the Feature Library's "linked WSI
-- cases" requirement has somewhere to point.

alter table public.cases add column slide_id uuid references public.slides (id) on delete set null;
alter table public.cases add column case_context text;
alter table public.cases add column lab_values text;
alter table public.cases add column final_diagnosis text;
alter table public.cases add column learning_points text;
alter table public.cases add column estimated_time_minutes integer check (estimated_time_minutes > 0);
alter table public.cases add column cpd_points integer not null default 0 check (cpd_points >= 0);

create table public.case_tags (
  case_id uuid not null references public.cases (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (case_id, tag_id)
);

create index case_tags_tag_id_idx on public.case_tags (tag_id);

alter table public.case_tags enable row level security;

create policy "case_tags: super admin full access"
  on public.case_tags for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "case_tags: content manager can manage their case's tags"
  on public.case_tags for all
  using (exists (select 1 from public.cases where cases.id = case_tags.case_id and cases.created_by = (select auth.uid())))
  with check (exists (select 1 from public.cases where cases.id = case_tags.case_id and cases.created_by = (select auth.uid())));

create policy "case_tags: read for published cases"
  on public.case_tags for select
  using (exists (select 1 from public.cases where cases.id = case_tags.case_id and cases.status = 'published'));

create table public.case_features (
  case_id uuid not null references public.cases (id) on delete cascade,
  feature_id uuid not null references public.features (id) on delete cascade,
  primary key (case_id, feature_id)
);

create index case_features_feature_id_idx on public.case_features (feature_id);

alter table public.case_features enable row level security;

create policy "case_features: super admin full access"
  on public.case_features for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "case_features: content manager can manage their case's features"
  on public.case_features for all
  using (exists (select 1 from public.cases where cases.id = case_features.case_id and cases.created_by = (select auth.uid())))
  with check (exists (select 1 from public.cases where cases.id = case_features.case_id and cases.created_by = (select auth.uid())));

create policy "case_features: read for published cases"
  on public.case_features for select
  using (exists (select 1 from public.cases where cases.id = case_features.case_id and cases.status = 'published'));
