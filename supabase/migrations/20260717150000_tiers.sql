-- Subscription tiers, and the organization -> tier relationship.

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  identifier text not null unique,
  monthly_price_cents integer not null,
  yearly_price_cents integer not null,
  created_at timestamptz not null default now()
);

alter table public.tiers enable row level security;

create policy "tiers: super admin full access"
  on public.tiers for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "tiers: authenticated read"
  on public.tiers for select
  using (auth.uid() is not null);

alter table public.organizations
  add column tier_id uuid references public.tiers (id) on delete set null;
