-- Self-signup can now produce Content Manager and Org Admin accounts
-- directly, not just Member. The requested role travels through
-- auth.users.raw_user_meta_data (set by the signup form), and is
-- validated here rather than trusted from the client — any value outside
-- the allowed set (including a crafted 'super_admin') silently falls back
-- to 'member'. The hardcoded Super Admin email still takes precedence over
-- any requested role, unchanged from before.
--
-- Choosing Org Admin at signup also creates a new Organization and makes
-- the signer its owner. No tier/seats/payment is attached yet (seats null
-- = unlimited, tier_id null) — that's a deliberate gap to fill in later
-- when Stripe checkout is wired to this flow; a Super Admin can assign a
-- tier via the existing tier-assignment UI in the meantime.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'signup_role';
  resolved_role public.app_role;
  org_name text := nullif(trim(new.raw_user_meta_data ->> 'org_name'), '');
  org_slug text;
  new_org_id uuid;
begin
  if new.email = 'consultant@optymumss.com' then
    resolved_role := 'super_admin';
  elsif requested_role in ('content_manager', 'org_admin') then
    resolved_role := requested_role::public.app_role;
  else
    resolved_role := 'member';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', resolved_role);

  if resolved_role = 'org_admin' then
    org_slug := regexp_replace(
      regexp_replace(lower(coalesce(org_name, 'organization')), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)', '', 'g'
    ) || '-' || substr(new.id::text, 1, 8);

    insert into public.organizations (name, slug)
    values (coalesce(org_name, 'My Organization'), org_slug)
    returning id into new_org_id;

    insert into public.organization_memberships (org_id, user_id, org_role)
    values (new_org_id, new.id, 'owner');
  end if;

  return new;
end;
$$;
