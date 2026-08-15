-- public.profiles only had a self-read SELECT policy (plus super-admin
-- ALL), which broke two real org-admin flows, both discovered via a live
-- end-to-end org-admin roster walkthrough (impersonation as a super admin
-- never hits either, since super_admin has its own ALL-access bypass):
--
-- 1. org/roster's addMember() looks up "does this email already have an
--    account" before deciding invite-vs-link -- that lookup always came
--    back empty for anyone but the org admin's own row, so every add of
--    an already-registered learner silently fell through to the brand-
--    new-invite path instead of linking the existing profile.
-- 2. The roster table's `organization_memberships.select("...profiles
--    (full_name, email)")` embed came back null for every member but the
--    org admin themself, so the roster always rendered real memberships
--    with a blank name/email.

-- A narrow SECURITY DEFINER lookup (same pattern as is_super_admin(),
-- can_manage_content()) that returns only the id for an exact email
-- match, nothing else -- enough for addMember() to link an existing
-- profile instead of re-inviting it, without broadening profiles SELECT
-- access generally.
create or replace function public.find_profile_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where email = p_email;
$$;

-- Function creation implicitly grants EXECUTE to PUBLIC (and Supabase's
-- default privileges separately extend that to anon/authenticated), so
-- revoke explicitly first and keep only authenticated -- matching the
-- existing is_org_admin()/is_super_admin() grant pattern.
revoke all on function public.find_profile_id_by_email(text) from public;
revoke all on function public.find_profile_id_by_email(text) from anon;
grant execute on function public.find_profile_id_by_email(text) to authenticated;

-- Let an org admin/owner read the profile of anyone who shares an
-- organization they administer, reusing the existing is_org_admin()
-- helper rather than a broader profiles-visible-to-everyone policy.
create policy "profiles: org admin can read their org's members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.user_id = profiles.id
        and public.is_org_admin(om.org_id)
    )
  );
