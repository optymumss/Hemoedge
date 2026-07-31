-- Content managers previously had no way to delete a slide row they'd
-- uploaded — only super admins could (via the "slides: super admin full
-- access" FOR ALL policy). Mirrors the existing edit policy's scope: a
-- content manager can only remove their own slides while still in draft or
-- bounced back with changes requested, not once submitted or published.
create policy "slides: content manager can delete their own draft or bounced work"
  on public.slides for delete
  using (public.can_manage_content('slides', id, created_by) and status in ('draft', 'changes_requested'));
