# Notifications Bell — Design Spec

## Problem

The shared `Header` component (`src/components/header.tsx`), rendered on every screen across all three portals (`/app`, `/org`, `/admin`), has a notifications bell button with no `onClick`, no badge/count, and no dropdown. There is no `notifications` table anywhere in the schema. This spec makes it real.

## Scope

Notifications are driven entirely by the existing content-review workflow (`src/lib/content/review-actions.ts`) — the one real, timestamped, submitter/decider event stream already in the schema:

- **`submitForReview`** (a `content_manager` submits draft/bounced content for review) → notifies **every `super_admin`** that a new submission is pending.
- **`reviewContent`** (a `super_admin` approves or requests changes) → notifies **the specific `content_manager` who submitted it** of the decision. This already sends an email (`reviewDecisionEmail`) at this exact point; this spec adds the in-app counterpart.

`org_admin` and `member` have no equivalent discrete event today (seat-limit and at-risk-learner figures are computed aggregates, not timestamped events) and are explicitly out of scope for this pass — their bell shows 0 unread and an empty dropdown. No new domain events are invented for them.

Out of scope: real-time push/live updates (the dropdown reflects the state as of page load and as of the last explicit refetch — no websocket/polling); a full "all notifications" history page (the dropdown shows the 10 most recent, full stop); header search (already shipped, PR #59); the Site Settings CMS (separate sub-project).

## Schema

```sql
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
```

- `title` is a **snapshot** of the content's title at the moment the notification is created — never joined back to `modules`/`cases`/etc. at read time. This keeps the dropdown query to a single `select` with no N+1 lookups, and keeps old notifications legible even if the content's title later changes or the row is deleted.
- `decision` is only set for `kind = 'review_decision'`; always `null` for `kind = 'submission_pending'`.
- Exactly one of `recipient_id` / `recipient_role` is set, enforced by the table check constraint. `recipient_role` currently only ever takes the value `'super_admin'` — the check constraint's single-value enum is deliberate, not an oversight, matching this pass's scope.

**Read tracking:** add one nullable column to `profiles`:

```sql
alter table public.profiles add column notifications_last_viewed_at timestamptz;
```

A `null` value means "never viewed" and is treated as equivalent to the epoch — i.e. every existing notification counts as unread the first time a user opens the bell. Opening the dropdown calls a server action that sets this column to `now()` for the current user, which clears the badge. There is no per-notification read/unread state — this single cursor is sufficient for a badge-count UI and avoids a join table.

## RLS

Plain policies relying on existing role-check functions (`is_super_admin()`, `profiles.role`) — no `SECURITY DEFINER` function, following the same simplification this codebase already uses for `platform_org_summary()`.

```sql
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
```

The two scoped INSERT policies mirror what `submitForReview` and `reviewContent` already validate about their caller (a content_manager submitting, a super_admin deciding) — the notification write can't outrun the privilege the surrounding action already required.

## Links

- `submission_pending` → `/admin/review-queue`. This page still lists the item (its `content_reviews` query filters `.is("decision", null)`), so the link stays live until someone decides it.
- `review_decision` → the content's own admin page: `/admin/{plural(content_type)}/{content_id}` (e.g. `/admin/modules/abc123`). **Not** `/admin/review-queue` — that page's query excludes decided rows the instant a decision is recorded, so linking there would be a dead end for exactly the notification meant to tell you the decision happened.
- Content-type pluralization: `slide → slides`, `feature → features`, `module → modules`, `case → cases`, `curriculum → curricula` (irregular plural, must be an explicit map, not a naive `+s`).

## Components

### `src/lib/notifications/format-notifications.ts` (pure, unit-tested)

```ts
export type NotificationRow = {
  id: string;
  kind: "submission_pending" | "review_decision";
  content_type: "slide" | "feature" | "module" | "case" | "curriculum";
  content_id: string;
  title: string;
  decision: "approved" | "changes_requested" | null;
  created_at: string;
};

export function buildNotificationHref(n: NotificationRow): string {
  if (n.kind === "submission_pending") return "/admin/review-queue";
  const plural: Record<NotificationRow["content_type"], string> = {
    slide: "slides",
    feature: "features",
    module: "modules",
    case: "cases",
    curriculum: "curricula",
  };
  return `/admin/${plural[n.content_type]}/${n.content_id}`;
}

export function formatNotificationMessage(n: NotificationRow): string {
  if (n.kind === "submission_pending") return `New submission awaiting review: "${n.title}"`;
  if (n.decision === "approved") return `"${n.title}" was approved`;
  return `"${n.title}" needs changes`;
}

export function countUnread(notifications: NotificationRow[], lastViewedAt: string | null): number {
  const cutoff = lastViewedAt ? new Date(lastViewedAt).getTime() : 0;
  return notifications.filter((n) => new Date(n.created_at).getTime() > cutoff).length;
}
```

`countUnread` treats a `null` cursor as "everything is unread" via a `0`-epoch cutoff, matching the read-tracking rule above. It only ever sees the 10 most-recently-fetched rows (see `get-notifications.ts` below), so if more than 10 notifications were unread at once, the count would floor at 10 rather than reflect the true total — acceptable because the badge display caps at `"9+"` regardless, so this can never produce a misleading number on screen.

### `src/lib/notifications/get-notifications.ts`

Exception-safe wrapper (same convention as `getPlatformOrgSummary`): fetches the 10 most recent notifications visible to the caller (RLS scopes this automatically) plus the caller's `notifications_last_viewed_at`, returning `{ notifications: NotificationRow[], lastViewedAt: string | null }`; returns `{ notifications: [], lastViewedAt: null }` on any error.

### `markNotificationsViewed` server action

A one-line server action: `update profiles set notifications_last_viewed_at = now() where id = auth.uid()`. Called by the client component when the dropdown opens.

### `src/components/notification-bell.tsx` (new, `"use client"`)

Receives its initial `{ notifications, lastViewedAt }` as props from the server-rendered `Header` (avoiding a client-side fetch on every page load, unlike header search which genuinely needs live querying). Owns:
- `open: boolean` — dropdown visibility, toggled by clicking the bell, closed on click-outside (same pattern as `HeaderSearch`'s `containerRef` + document `mousedown` listener).
- Badge: `countUnread(notifications, lastViewedAt)`, rendered as a numeric badge capped at display `"9+"` for any count ≥ 10; hidden entirely when the count is `0`.
- On open: calls `markNotificationsViewed()` (fire-and-forget) and optimistically updates local `lastViewedAt` to now so the badge clears immediately without waiting on the round-trip.
- Dropdown rows: `formatNotificationMessage(n)` as the row text, linked via `buildNotificationHref(n)`; `review_decision` rows get a small `success`/`danger`-toned left accent or dot matching `n.decision` (reusing the existing `success`/`danger` semantic tokens, the same ones the org dashboard's at-risk severity dots use) — `submission_pending` rows are neutral/unaccented.
- Empty state: "No notifications yet." when the list is empty (the only state `org_admin`/`member` will ever see, by design).

### `src/components/header.tsx`

Fetches `getNotifications(supabase)` server-side (same pattern already used for `getPlatformOrgSummary` in `/admin/page.tsx`, just moved one level up into the shared header) and passes the result into `<NotificationBell notifications={...} lastViewedAt={...} />`, replacing the current static `<button>`.

### `src/lib/content/review-actions.ts`

Two insertions, both using data these functions already fetch:

- In `submitForReview`, after the existing `content_reviews` insert: fetch the content's `title` (one extra `select`, mirroring the pattern `reviewContent` already uses) and insert one `notifications` row with `kind: "submission_pending"`, `recipient_role: "super_admin"`.
- In `reviewContent`, inside the existing `if (pending) { ... }` block that already fetches `content.title` for the email — insert one `notifications` row with `kind: "review_decision"`, `recipient_id: pending.submitted_by`, `decision`, using the same `content.title` already in scope. No extra query needed here.

## Data flow

1. A content_manager submits → `submitForReview` inserts a `content_reviews` row (existing) and a `notifications` row targeting `recipient_role: 'super_admin'` (new).
2. Every `super_admin`'s next page load (any portal) fetches notifications server-side in `Header`; RLS surfaces that row to them via the `recipient_role` policy.
3. A super_admin decides → `reviewContent` inserts a `notifications` row targeting `recipient_id` = the submitter (new), alongside its existing email send.
4. That specific content_manager's next page load surfaces it via the `recipient_id` policy.
5. Opening the bell calls `markNotificationsViewed`, advancing that user's cursor so already-seen items stop counting as unread.

## Error handling

- `getNotifications` failures (network, RLS-denied, etc.) resolve to an empty list and `null` cursor — renders as the same empty-state UI as a user with no notifications at all, never an error banner.
- The two new inserts in `review-actions.ts` are best-effort: if the `notifications` insert fails, the surrounding review/submission action still succeeds (the status update and `content_reviews` row are the source of truth; a missed notification is a degraded-but-recoverable outcome, not a reason to fail the whole submit/review action). Wrap each new insert so its error is swallowed rather than propagated.

## Testing

- Unit tests (`src/lib/notifications/format-notifications.test.ts`): `buildNotificationHref` for both kinds and all five content types (including the irregular `curriculum → curricula` plural); `formatNotificationMessage` for all three message shapes (pending, approved, changes_requested); `countUnread` with a `null` cursor (everything unread), a cursor after all items (nothing unread), and a cursor strictly between two items' timestamps (boundary: equal-to-cursor does not count as unread, matches the `>` comparison above).
- Live Playwright verification: as `demo.contentmanager@optymumss.com`, submit a piece of content for review and confirm `demo.superadmin@optymumss.com` sees a badge and the `submission_pending` row linking to `/admin/review-queue`; as `demo.superadmin@optymumss.com`, decide it (both `approved` and `changes_requested` cases) and confirm `demo.contentmanager@optymumss.com` sees a badge and a `review_decision` row with the correct success/danger styling, linking to the content's own admin page; confirm the badge clears after opening the dropdown and reloading; confirm `demo.learner@optymumss.com` and `demo.orgadmin@optymumss.com` see an empty bell throughout. Light theme, dark theme, and mobile viewport.
