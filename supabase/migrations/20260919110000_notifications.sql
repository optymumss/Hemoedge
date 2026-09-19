-- Notifications bell: driven entirely by the content-review workflow.
-- Exactly one of recipient_id (a specific user) or recipient_role
-- (currently only 'super_admin', a broadcast) is set per row. Plain RLS,
-- no SECURITY DEFINER -- the same simplification already used for
-- platform_org_summary(): the two INSERT policies below mirror exactly
-- what submitForReview/reviewContent already validate about their caller,
-- so the notification write can't outrun the privilege the surrounding
-- action already required.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_role text check (recipient_role in ('super_admin')),
  kind text not null check (kind in ('submission_pending', 'review_decision')),
  content_type text not null check (content_type in ('slide', 'feature', 'module', 'case', 'curriculum')),
  content_id uuid not null,
  title text not null,
  decision text check (decision in ('approved', 'changes_requested')),
  created_at timestamptz not null default now(),
  check (
    (recipient_id is not null and recipient_role is null)
    or (recipient_id is null and recipient_role is not null)
  )
);

create index notifications_recipient_id_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_role_idx on public.notifications (recipient_role, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: recipient can read their own or their role's"
  on public.notifications for select
  using (
    recipient_id = (select auth.uid())
    or (recipient_role = 'super_admin' and public.is_super_admin())
  );

create policy "notifications: content manager can broadcast a pending submission"
  on public.notifications for insert
  with check (
    kind = 'submission_pending'
    and recipient_role = 'super_admin'
    and recipient_id is null
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'content_manager'
    )
  );

create policy "notifications: super admin can notify a submitter of a decision"
  on public.notifications for insert
  with check (
    kind = 'review_decision'
    and recipient_id is not null
    and recipient_role is null
    and public.is_super_admin()
  );

create policy "notifications: super admin full access"
  on public.notifications for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Single-cursor read tracking: null means "never viewed", treated as the
-- epoch (everything unread) rather than needing a per-notification join
-- table.
alter table public.profiles add column notifications_last_viewed_at timestamptz;
