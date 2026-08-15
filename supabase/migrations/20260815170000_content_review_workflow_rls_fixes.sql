-- The content-manager "can edit their own draft or bounced work" UPDATE
-- policies on every content table had no WITH CHECK clause. Per Postgres
-- RLS semantics, an UPDATE policy without WITH CHECK reuses its USING
-- expression to validate the *new* row too -- and USING requires
-- status IN (draft, changes_requested), which the new row (status =
-- in_review) never satisfies. This silently blocked every "Submit for
-- review" click across the whole app: the row was never actually
-- updated, no error was surfaced, and no content manager could ever get
-- a submission in front of a super admin. Discovered via a live
-- end-to-end workflow walkthrough (content manager -> super admin ->
-- org admin -> member), not caught by any prior spot-check.
--
-- Fix: add an explicit WITH CHECK that allows the manager's own update
-- to land on draft, changes_requested, or in_review -- but never
-- published, which stays gated to the super-admin-only policy.
alter policy "cases: content manager can edit their own draft or bounced work"
  on public.cases
  with check (
    can_manage_content('cases', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

alter policy "curricula: content manager can edit their own draft or bounced "
  on public.curricula
  with check (
    can_manage_content('curricula', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

alter policy "features: content manager can edit their own draft or bounced w"
  on public.features
  with check (
    can_manage_content('features', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

alter policy "modules: content manager can edit their own draft or bounced wo"
  on public.modules
  with check (
    can_manage_content('modules', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

alter policy "slides: content manager can edit their own draft or bounced wor"
  on public.slides
  with check (
    can_manage_content('slides', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

alter policy "wbc_diff_exercises: content manager can edit their own draft or"
  on public.wbc_diff_exercises
  with check (
    can_manage_content('wbc_diff_exercise', id, created_by)
    and status = any (array['draft', 'changes_requested', 'in_review']::content_status[])
  );

-- content_reviews had no INSERT policy at all for regular users (only a
-- super-admin ALL policy and a submitter-can-read-own SELECT policy).
-- RLS defaults to deny when no policy matches a command, so
-- submitForReview()'s insert into content_reviews was silently blocked
-- for every content manager -- meaning even after fixing the status
-- update above, the Review Queue would still show nothing, since it
-- reads from this table.
create policy "content_reviews: submitter can insert their own"
  on public.content_reviews for insert
  with check (submitted_by = (select auth.uid()));
