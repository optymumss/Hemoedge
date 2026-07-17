-- Phase 1: Content Manager Workspace
-- NOT YET APPLIED to the live project — drafted alongside Phase 0 so the
-- schema is ready when we pick migrations back up.
--
-- Adds the content library tables (slides, cell types, features, modules,
-- cases, curricula), the draft/review/publish workflow, the scoped-access
-- table for external faculty Content Managers, the review audit trail, and
-- what each organization has chosen to teach from the published catalog.

-- Shared status for every authored content type.
create type public.content_status as enum (
  'draft',
  'in_review',
  'changes_requested',
  'published'
);

create type public.content_level as enum ('beginner', 'intermediate', 'advanced');

-- Slide categories: two-level hierarchy, syndrome group -> diagnosis.
create table public.slide_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.slide_categories (id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create table public.cell_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  slug text not null unique,
  lineage text not null check (lineage in ('red_cell', 'white_cell', 'platelet')),
  created_at timestamptz not null default now()
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.slide_categories (id) on delete set null,
  file_path text,
  size_bytes bigint,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.features (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  definition text,
  cell_type_id uuid references public.cell_types (id) on delete set null,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.content_level not null,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.content_level not null,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level public.content_level not null,
  pass_threshold integer not null default 70,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Restricts an external faculty Content Manager to specific content items.
-- A content_manager with zero rows here is unrestricted (the internal-staff
-- default); one with rows may only touch the referenced content.
create table public.content_scopes (
  id uuid primary key default gen_random_uuid(),
  content_manager_id uuid not null references public.profiles (id) on delete cascade,
  content_type text not null check (content_type in ('slide', 'feature', 'module', 'case', 'curriculum')),
  content_id uuid not null,
  created_at timestamptz not null default now(),
  unique (content_manager_id, content_type, content_id)
);

-- Audit trail for the Content Manager -> Super Admin review gate.
create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('slide', 'feature', 'module', 'case', 'curriculum')),
  content_id uuid not null,
  submitted_by uuid not null references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  decision text check (decision in ('approved', 'changes_requested')),
  notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- What an organization has chosen to teach from the published catalog —
-- supports cherry-picking individual modules/cases as well as curricula.
create table public.org_catalog_selections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_type text not null check (content_type in ('module', 'case', 'curriculum')),
  content_id uuid not null,
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (org_id, content_type, content_id)
);

alter table public.slide_categories enable row level security;
alter table public.cell_types enable row level security;
alter table public.slides enable row level security;
alter table public.features enable row level security;
alter table public.modules enable row level security;
alter table public.cases enable row level security;
alter table public.curricula enable row level security;
alter table public.content_scopes enable row level security;
alter table public.content_reviews enable row level security;
alter table public.org_catalog_selections enable row level security;

-- Helper: may the current user author/edit this specific content item?
-- True for super admins always; for content managers, true if they created
-- it, or if it's within a scope explicitly granted to them.
create function public.can_manage_content(p_content_type text, p_content_id uuid, p_created_by uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      p_created_by = auth.uid()
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager')
    )
    or exists (
      select 1 from public.content_scopes
      where content_manager_id = auth.uid()
        and content_type = p_content_type
        and content_id = p_content_id
    );
$$;

-- Reference/taxonomy tables (slide_categories, cell_types): readable by any
-- authenticated user, writable by super admins and content managers.
create policy "taxonomy: authenticated read (slide_categories)"
  on public.slide_categories for select
  using (auth.uid() is not null);

create policy "taxonomy: content staff write (slide_categories)"
  on public.slide_categories for all
  using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'))
  with check (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'));

create policy "taxonomy: authenticated read (cell_types)"
  on public.cell_types for select
  using (auth.uid() is not null);

create policy "taxonomy: content staff write (cell_types)"
  on public.cell_types for all
  using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'))
  with check (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager'));

-- Authored content tables (slides, features, modules, cases, curricula)
-- share the same policy shape; repeated per table since RLS can't be
-- parameterized across tables.
do $$
declare
  t text;
begin
  foreach t in array array['slides', 'features', 'modules', 'cases', 'curricula']
  loop
    execute format($f$
      create policy "%1$s: super admin full access"
        on public.%1$s for all
        using (public.is_super_admin())
        with check (public.is_super_admin());
    $f$, t);

    execute format($f$
      create policy "%1$s: anyone can read published"
        on public.%1$s for select
        using (status = 'published');
    $f$, t);

    execute format($f$
      create policy "%1$s: content manager can read own"
        on public.%1$s for select
        using (created_by = auth.uid());
    $f$, t);

    execute format($f$
      create policy "%1$s: content manager can create"
        on public.%1$s for insert
        with check (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager')
          and created_by = auth.uid()
          and status = 'draft'
        );
    $f$, t);

    execute format($f$
      create policy "%1$s: content manager can edit their own draft or bounced work"
        on public.%1$s for update
        using (public.can_manage_content('%1$s', id, created_by) and status in ('draft', 'changes_requested'));
    $f$, t);
  end loop;
end $$;

-- content_scopes: super admin manages; a content manager can see their own scopes.
create policy "content_scopes: super admin full access"
  on public.content_scopes for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "content_scopes: self read"
  on public.content_scopes for select
  using (content_manager_id = auth.uid());

-- content_reviews: super admin manages everything; a content manager can see
-- reviews of content they submitted.
create policy "content_reviews: super admin full access"
  on public.content_reviews for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "content_reviews: submitter can read their own"
  on public.content_reviews for select
  using (submitted_by = auth.uid());

-- org_catalog_selections: super admin full access; org admins manage their
-- own org's picks; org members can see what's been selected for their org.
create policy "org_catalog_selections: super admin full access"
  on public.org_catalog_selections for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "org_catalog_selections: org admin manages their org's picks"
  on public.org_catalog_selections for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "org_catalog_selections: org members can view their org's picks"
  on public.org_catalog_selections for select
  using (
    exists (
      select 1 from public.organization_memberships
      where org_id = org_catalog_selections.org_id and user_id = auth.uid()
    )
  );
