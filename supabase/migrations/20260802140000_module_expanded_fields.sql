-- Modules only had Title, Competency Level, and Description — missing most
-- of the fields a serious morphology training platform needs. Also adds
-- Tags as shared taxonomy (starting with Modules; other content types can
-- link to the same tags table later) and CPD Points on modules.

alter table public.modules add column module_type text
  check (module_type in ('foundation', 'fbc', 'morphology', 'case_based', 'practical', 'assessment'));
alter table public.modules add column learning_objectives text;
alter table public.modules add column teaching_notes text;
alter table public.modules add column estimated_duration_minutes integer check (estimated_duration_minutes > 0);
alter table public.modules add column cpd_points integer not null default 0 check (cpd_points >= 0);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "tags: authenticated read"
  on public.tags for select
  using ((select auth.uid()) is not null);

create policy "tags: content staff write"
  on public.tags for all
  using (public.is_super_admin() or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager'))
  with check (public.is_super_admin() or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'content_manager'));

create table public.module_tags (
  module_id uuid not null references public.modules (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (module_id, tag_id)
);

-- The primary key already indexes module_id (leading column); tag_id needs
-- its own index for the reverse lookup ("modules with this tag").
create index module_tags_tag_id_idx on public.module_tags (tag_id);

alter table public.module_tags enable row level security;

-- Mirrors the lessons table's RLS shape: super admin full access, content
-- manager scoped to modules they created, everyone else read-only once the
-- module is published.
create policy "module_tags: super admin full access"
  on public.module_tags for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "module_tags: content manager can manage their module's tags"
  on public.module_tags for all
  using (exists (select 1 from public.modules where modules.id = module_tags.module_id and modules.created_by = (select auth.uid())))
  with check (exists (select 1 from public.modules where modules.id = module_tags.module_id and modules.created_by = (select auth.uid())));

create policy "module_tags: read for published modules"
  on public.module_tags for select
  using (exists (select 1 from public.modules where modules.id = module_tags.module_id and modules.status = 'published'));

create table public.module_prerequisites (
  module_id uuid not null references public.modules (id) on delete cascade,
  prerequisite_module_id uuid not null references public.modules (id) on delete cascade,
  primary key (module_id, prerequisite_module_id),
  check (module_id <> prerequisite_module_id)
);

alter table public.module_prerequisites enable row level security;

create policy "module_prerequisites: super admin full access"
  on public.module_prerequisites for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "module_prerequisites: content manager can manage their module's prerequisites"
  on public.module_prerequisites for all
  using (exists (select 1 from public.modules where modules.id = module_prerequisites.module_id and modules.created_by = (select auth.uid())))
  with check (exists (select 1 from public.modules where modules.id = module_prerequisites.module_id and modules.created_by = (select auth.uid())));

create policy "module_prerequisites: read for published modules"
  on public.module_prerequisites for select
  using (exists (select 1 from public.modules where modules.id = module_prerequisites.module_id and modules.status = 'published'));
