-- Phase 0: Access Foundation
-- Roles, profiles, organizations, and organization memberships for the
-- Super Admin / Content Manager / Org Admin / Member model.

-- 1. Role enum
create type public.app_role as enum ('super_admin', 'content_manager', 'org_admin', 'member');

-- 2. Profiles (mirrors auth.users, carries the platform role)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile on signup. The founding account bootstraps as super_admin;
-- everyone else starts as a member and is promoted by a super admin.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when new.email = 'consultant@optymumss.com' then 'super_admin' else 'member' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current user a super admin? SECURITY DEFINER so it can be used
-- inside RLS policies (including on profiles itself) without recursive lookups.
create function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- profiles RLS
create policy "profiles: self read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: self update"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles: super admin full access"
  on public.profiles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- A user can update their own row (name, etc.) but never their own role.
create function public.prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and not public.is_super_admin() then
    raise exception 'Only a super admin can change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_no_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- 3. Organizations — created by Super Admins only
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  seats integer,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- 4. Organization memberships — an Org Admin (org_role owner|admin) manages their
-- own roster; a plain member only sees their own row.
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  org_role text not null default 'member' check (org_role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

alter table public.organization_memberships enable row level security;

-- Helper: is the current user an owner/admin of the given org?
create function public.is_org_admin(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_memberships
    where org_id = target_org
      and user_id = auth.uid()
      and org_role in ('owner', 'admin')
  );
$$;

-- organizations RLS
create policy "organizations: super admin full access"
  on public.organizations for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "organizations: members can view their own org"
  on public.organizations for select
  using (
    exists (
      select 1 from public.organization_memberships
      where org_id = organizations.id and user_id = auth.uid()
    )
  );

-- organization_memberships RLS
create policy "memberships: super admin full access"
  on public.organization_memberships for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "memberships: self read"
  on public.organization_memberships for select
  using (user_id = auth.uid());

create policy "memberships: org admin can view their org roster"
  on public.organization_memberships for select
  using (public.is_org_admin(org_id));

-- Org Admins invite/remove learners (org_role = 'member') only; promoting someone
-- to owner/admin stays a Super Admin action.
create policy "memberships: org admin can invite members"
  on public.organization_memberships for insert
  with check (public.is_org_admin(org_id) and org_role = 'member');

create policy "memberships: org admin can remove members"
  on public.organization_memberships for delete
  using (public.is_org_admin(org_id) and org_role = 'member');
