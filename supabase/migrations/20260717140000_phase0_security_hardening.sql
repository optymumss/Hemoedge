-- Security hardening flagged by Supabase's advisor after applying Phase 0/1:
-- pin search_path on the one function that was missing it, and restrict the
-- internal SECURITY DEFINER helpers so they're only reachable through RLS
-- policy evaluation (as authenticated), not as public RPC endpoints.

alter function public.prevent_self_role_escalation() set search_path = public;

-- Pure trigger function — never called directly, no RPC access needed.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_admin(uuid) to authenticated;

revoke execute on function public.can_manage_content(text, uuid, uuid) from public, anon;
grant execute on function public.can_manage_content(text, uuid, uuid) to authenticated;
