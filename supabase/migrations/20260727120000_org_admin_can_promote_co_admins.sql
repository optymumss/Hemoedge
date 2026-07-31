-- Lets an Org Admin promote a member of their own org to co-Org-Admin
-- (org_role 'admin'), and demote a co-admin back to member. The 'owner'
-- row (set at org creation) is deliberately excluded from both directions
-- of this policy — it can't be touched by a co-admin, so an org can never
-- end up with zero admins through this action.

create policy "memberships: org admin can promote or demote co-admins"
  on public.organization_memberships for update
  using (public.is_org_admin(org_id) and org_role in ('member', 'admin'))
  with check (public.is_org_admin(org_id) and org_role in ('member', 'admin'));
