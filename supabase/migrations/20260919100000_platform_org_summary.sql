-- Super-admin cross-org dashboard: one row per organization with its
-- member count, computed as a single grouped join rather than fetching
-- membership rows into Node. Deliberately NOT security definer and NOT
-- gated by is_super_admin() — organizations and organization_memberships
-- both already carry a "super admin full access" RLS policy, so a plain
-- invoker-rights function is naturally safe: RLS on the underlying tables
-- governs what any caller sees, the same trust boundary every other
-- direct .from(...) read in this codebase already relies on. A
-- non-super-admin caller gets back only whatever their own RLS already
-- permits (e.g. an org_admin sees at most their own org's row) — never
-- the platform-wide list.
create function public.platform_org_summary()
returns table (
  org_id uuid,
  name text,
  seats integer,
  status text,
  created_at timestamptz,
  member_count integer
)
language sql
stable
set search_path = public
as $$
  select o.id, o.name, o.seats, o.status, o.created_at, count(m.user_id)::integer as member_count
  from public.organizations o
  left join public.organization_memberships m on m.org_id = o.id
  group by o.id, o.name, o.seats, o.status, o.created_at
  order by o.name;
$$;
