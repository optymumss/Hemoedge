# Notifications Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared `Header` component's static, non-functional notifications bell with a real notifications system driven by the existing content-review workflow.

**Architecture:** A new `notifications` table (plain RLS, no `SECURITY DEFINER`) holds either a specific-user or a role-broadcast notification, written at the two points `src/lib/content/review-actions.ts` already mutates state (`submitForReview`, `reviewContent`). A pure formatting module handles link-building, message text, and unread counting. A server-side data wrapper feeds the server-rendered `Header`, which passes initial data into a client `NotificationBell` component that owns the dropdown UI and calls a one-line "mark viewed" server action on open.

**Tech Stack:** Next.js App Router (server + client components), Supabase Postgres (RLS), Vitest, Playwright (`/opt/pw-browsers/chromium`) for live verification.

## Global Constraints

- Notification sources are exactly two: `submitForReview` (content_manager → all `super_admin`s, `kind: "submission_pending"`) and `reviewContent` (super_admin → the specific submitter, `kind: "review_decision"`). No other event generates a notification in this pass.
- `org_admin` and `member` never receive a notification in this pass — their bell shows 0 unread and an empty dropdown.
- Exactly one of `recipient_id` / `recipient_role` is set per row (`recipient_role` only ever `'super_admin'`), enforced by a table check constraint.
- `title` is a snapshot captured at notification-creation time — never joined back to content tables at read time.
- Read tracking is a single `profiles.notifications_last_viewed_at` cursor (nullable; `null` = everything unread) — no per-notification read state.
- Badge: numeric count, capped at display `"9+"` for any count ≥ 10, hidden entirely at 0.
- `review_decision` rows are styled with the existing `success`/`danger` semantic tokens per `decision`; `submission_pending` rows are neutral.
- Links: `submission_pending` → `/admin/review-queue`; `review_decision` → `/admin/{plural(content_type)}/{content_id}` using the irregular-plural map `slide→slides, feature→features, module→modules, case→cases, curriculum→curricula`. Never link a decided item to `/admin/review-queue` — its query excludes decided rows.
- Dropdown shows at most the 10 most recent notifications. No full-history page in this pass.
- The two new inserts into `review-actions.ts` are best-effort: their failure must never fail the surrounding submit/review action.

---

### Task 1: `notifications` table, RLS, and `profiles` column

**Files:**
- Create: `supabase/migrations/20260919110000_notifications.sql`
- Modify: `src/lib/supabase/database.types.ts` (splice in the new `notifications` table and the `profiles` column)

**Interfaces:**
- Consumes: nothing (schema-only task).
- Produces: the `public.notifications` table (columns: `id, recipient_id, recipient_role, kind, content_type, content_id, title, decision, created_at`) and `public.profiles.notifications_last_viewed_at`, both reflected in `Database["public"]["Tables"]` in `database.types.ts`. Task 2 imports a `NotificationRow` type shaped from these columns (defined in Task 2, not here — Task 2's type is hand-written to match this schema exactly). Task 3 selects these exact column names.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260919110000_notifications.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run `mcp__Supabase__apply_migration` against the project (`uktdipvvnbgzasqlpudl`) with the file's contents, using `20260919110000_notifications` as the migration name.

- [ ] **Step 3: Regenerate and splice in types**

Run `mcp__Supabase__generate_typescript_types`. It will exceed the tool's inline limit and save to a file — extract the `notifications` entry from the `Tables` block and the updated `profiles` entry (with the new `notifications_last_viewed_at` column) and splice both into `src/lib/supabase/database.types.ts`'s existing `Tables` object, replacing the old `profiles` entry and adding the new `notifications` entry alongside it.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919110000_notifications.sql src/lib/supabase/database.types.ts
git commit -m "Add notifications table, RLS, and profiles.notifications_last_viewed_at"
```

---

### Task 2: Pure formatting logic

**Files:**
- Create: `src/lib/notifications/format-notifications.ts`
- Test: `src/lib/notifications/format-notifications.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other tasks — hand-written types matching Task 1's schema).
- Produces:
  - `type NotificationRow = { id: string; kind: "submission_pending" | "review_decision"; content_type: "slide" | "feature" | "module" | "case" | "curriculum"; content_id: string; title: string; decision: "approved" | "changes_requested" | null; created_at: string }`
  - `buildNotificationHref(n: NotificationRow): string`
  - `formatNotificationMessage(n: NotificationRow): string`
  - `countUnread(notifications: NotificationRow[], lastViewedAt: string | null): number`
  - Task 3 imports `NotificationRow`. Task 5 imports all three functions and `NotificationRow`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/notifications/format-notifications.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildNotificationHref,
  formatNotificationMessage,
  countUnread,
  type NotificationRow,
} from "./format-notifications";

function makeRow(overrides: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    id: overrides.id,
    kind: overrides.kind ?? "submission_pending",
    content_type: overrides.content_type ?? "module",
    content_id: overrides.content_id ?? "content-1",
    title: overrides.title ?? "Some Title",
    decision: overrides.decision ?? null,
    created_at: overrides.created_at ?? "2026-09-19T00:00:00.000Z",
  };
}

describe("buildNotificationHref", () => {
  it("links submission_pending to the review queue", () => {
    const row = makeRow({ id: "a", kind: "submission_pending" });
    expect(buildNotificationHref(row)).toBe("/admin/review-queue");
  });

  it("links review_decision to the content's own admin page for each content type", () => {
    const cases: [NotificationRow["content_type"], string][] = [
      ["slide", "slides"],
      ["feature", "features"],
      ["module", "modules"],
      ["case", "cases"],
      ["curriculum", "curricula"],
    ];
    for (const [contentType, plural] of cases) {
      const row = makeRow({
        id: contentType,
        kind: "review_decision",
        content_type: contentType,
        content_id: "xyz",
        decision: "approved",
      });
      expect(buildNotificationHref(row)).toBe(`/admin/${plural}/xyz`);
    }
  });
});

describe("formatNotificationMessage", () => {
  it("formats a submission_pending message", () => {
    const row = makeRow({ id: "a", kind: "submission_pending", title: "Iron Deficiency Anaemia" });
    expect(formatNotificationMessage(row)).toBe('New submission awaiting review: "Iron Deficiency Anaemia"');
  });

  it("formats an approved review_decision message", () => {
    const row = makeRow({ id: "a", kind: "review_decision", decision: "approved", title: "My Module" });
    expect(formatNotificationMessage(row)).toBe('"My Module" was approved');
  });

  it("formats a changes_requested review_decision message", () => {
    const row = makeRow({ id: "a", kind: "review_decision", decision: "changes_requested", title: "My Module" });
    expect(formatNotificationMessage(row)).toBe('"My Module" needs changes');
  });
});

describe("countUnread", () => {
  it("counts everything as unread when lastViewedAt is null", () => {
    const rows = [
      makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
      makeRow({ id: "b", created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(countUnread(rows, null)).toBe(2);
  });

  it("counts nothing as unread when lastViewedAt is after every notification", () => {
    const rows = [makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" })];
    expect(countUnread(rows, "2026-06-01T00:00:00.000Z")).toBe(0);
  });

  it("counts only notifications strictly newer than lastViewedAt (boundary: equal does not count)", () => {
    const rows = [
      makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
      makeRow({ id: "b", created_at: "2026-03-01T00:00:00.000Z" }),
    ];
    expect(countUnread(rows, "2026-01-01T00:00:00.000Z")).toBe(1);
  });

  it("returns 0 for an empty notification list", () => {
    expect(countUnread([], null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/notifications/format-notifications.test.ts`
Expected: FAIL — `Cannot find module './format-notifications'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/notifications/format-notifications.ts`:

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

const CONTENT_TYPE_PLURAL: Record<NotificationRow["content_type"], string> = {
  slide: "slides",
  feature: "features",
  module: "modules",
  case: "cases",
  curriculum: "curricula",
};

export function buildNotificationHref(n: NotificationRow): string {
  if (n.kind === "submission_pending") return "/admin/review-queue";
  return `/admin/${CONTENT_TYPE_PLURAL[n.content_type]}/${n.content_id}`;
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/notifications/format-notifications.test.ts`
Expected: PASS — 9/9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/format-notifications.ts src/lib/notifications/format-notifications.test.ts
git commit -m "Add pure notification formatting logic (links, messages, unread count)"
```

---

### Task 3: Data wrapper and mark-viewed action

**Files:**
- Create: `src/lib/notifications/get-notifications.ts`
- Create: `src/lib/notifications/mark-viewed.ts`

**Interfaces:**
- Consumes: `NotificationRow` from `src/lib/notifications/format-notifications.ts` (Task 1); `createClient` from `@/lib/supabase/server`.
- Produces:
  - `type NotificationsResult = { notifications: NotificationRow[]; lastViewedAt: string | null }`
  - `getNotifications(supabase: Awaited<ReturnType<typeof createClient>>): Promise<NotificationsResult>`
  - `markNotificationsViewed(): Promise<void>` (a `"use server"` action, no arguments — reads the caller from the session)
  - Task 5 imports both.

- [ ] **Step 1: Write the data wrapper**

Create `src/lib/notifications/get-notifications.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "./format-notifications";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type NotificationsResult = {
  notifications: NotificationRow[];
  lastViewedAt: string | null;
};

const EMPTY_RESULT: NotificationsResult = { notifications: [], lastViewedAt: null };

export async function getNotifications(supabase: SupabaseClient): Promise<NotificationsResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return EMPTY_RESULT;

    const [{ data: notifications, error: notificationsError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("notifications")
          .select("id, kind, content_type, content_id, title, decision, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("profiles").select("notifications_last_viewed_at").eq("id", user.id).single(),
      ]);

    if (notificationsError || profileError) return EMPTY_RESULT;
    return {
      notifications: (notifications ?? []) as NotificationRow[],
      lastViewedAt: profile?.notifications_last_viewed_at ?? null,
    };
  } catch {
    return EMPTY_RESULT;
  }
}
```

This function is not unit-tested directly — it's a thin Supabase-calling wrapper with no branching logic worth mocking, the same convention `getPlatformOrgSummary` and `searchContent` already follow in this codebase. It's proven correct via Task 6's live verification.

- [ ] **Step 2: Write the mark-viewed action**

Create `src/lib/notifications/mark-viewed.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationsViewed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ notifications_last_viewed_at: new Date().toISOString() })
    .eq("id", user.id);
}
```

The existing `"profiles: self update"` RLS policy (`using (id = (select auth.uid()))`, no column restriction beyond the separate `profiles_no_self_role_escalation` trigger that only guards the `role` column) already permits this update — no new policy needed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/get-notifications.ts src/lib/notifications/mark-viewed.ts
git commit -m "Add getNotifications wrapper and markNotificationsViewed action"
```

---

### Task 4: Wire notification creation into the review workflow

**Files:**
- Modify: `src/lib/content/review-actions.ts`

**Interfaces:**
- Consumes: nothing new (writes directly to the `notifications` table via the same `supabase` client each function already holds).
- Produces: nothing new for other tasks — this task's effect is observed only through the `notifications` rows it creates, verified in Task 6.

- [ ] **Step 1: Read the current file to confirm line numbers**

Read `src/lib/content/review-actions.ts` in full before editing — the exact line numbers below assume the file's state as of the header-search-era codebase and may have shifted.

- [ ] **Step 2: Insert a `submission_pending` notification in `submitForReview`**

Replace:

```ts
  const table = CONTENT_TABLES[contentType];
  await supabase.from(table).update({ status: "in_review" }).eq("id", id);
  await supabase.from("content_reviews").insert({
    content_type: contentType,
    content_id: id,
    submitted_by: user.id,
  });

  revalidatePath(path);
  revalidatePath("/admin/review-queue");
}
```

with:

```ts
  const table = CONTENT_TABLES[contentType];
  await supabase.from(table).update({ status: "in_review" }).eq("id", id);
  await supabase.from("content_reviews").insert({
    content_type: contentType,
    content_id: id,
    submitted_by: user.id,
  });

  const { data: submittedContent } = await supabase.from(table).select("title").eq("id", id).single();
  if (submittedContent) {
    try {
      await supabase.from("notifications").insert({
        recipient_role: "super_admin",
        kind: "submission_pending",
        content_type: contentType,
        content_id: id,
        title: submittedContent.title,
      });
    } catch {
      // Best-effort: a missed notification never fails the submission itself.
    }
  }

  revalidatePath(path);
  revalidatePath("/admin/review-queue");
}
```

- [ ] **Step 3: Insert a `review_decision` notification in `reviewContent`**

Replace:

```ts
  if (pending) {
    const [{ data: content }, { data: submitter }] = await Promise.all([
      supabase.from(table).select("title").eq("id", id).single(),
      supabase.from("profiles").select("email").eq("id", pending.submitted_by).single(),
    ]);
    if (content && submitter) {
      const { subject, html } = reviewDecisionEmail(content.title, decision, notes);
      await sendEmail(submitter.email, subject, html);
    }
  }

  revalidatePath("/admin/review-queue");
}
```

with:

```ts
  if (pending) {
    const [{ data: content }, { data: submitter }] = await Promise.all([
      supabase.from(table).select("title").eq("id", id).single(),
      supabase.from("profiles").select("email").eq("id", pending.submitted_by).single(),
    ]);
    if (content && submitter) {
      const { subject, html } = reviewDecisionEmail(content.title, decision, notes);
      await sendEmail(submitter.email, subject, html);
    }
    if (content) {
      try {
        await supabase.from("notifications").insert({
          recipient_id: pending.submitted_by,
          kind: "review_decision",
          content_type: contentType,
          content_id: id,
          title: content.title,
          decision,
        });
      } catch {
        // Best-effort: a missed notification never fails the review decision itself.
      }
    }
  }

  revalidatePath("/admin/review-queue");
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/lib/content/review-actions.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/review-actions.ts
git commit -m "Create notifications at the two content-review workflow decision points"
```

---

### Task 5: NotificationBell component and Header integration

**Files:**
- Create: `src/components/notification-bell.tsx`
- Modify: `src/components/header.tsx`

**Interfaces:**
- Consumes: `buildNotificationHref`, `formatNotificationMessage`, `countUnread`, `NotificationRow` (Task 2); `getNotifications`, `NotificationsResult` (Task 3); `markNotificationsViewed` (Task 3).
- Produces: `export function NotificationBell({ notifications, lastViewedAt }: { notifications: NotificationRow[]; lastViewedAt: string | null })` — rendered by `Header`.

- [ ] **Step 1: Create the component**

Create `src/components/notification-bell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NotificationRow } from "@/lib/notifications/format-notifications";
import { buildNotificationHref, formatNotificationMessage, countUnread } from "@/lib/notifications/format-notifications";
import { markNotificationsViewed } from "@/lib/notifications/mark-viewed";

export function NotificationBell({
  notifications,
  lastViewedAt: initialLastViewedAt,
}: {
  notifications: NotificationRow[];
  lastViewedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [lastViewedAt, setLastViewedAt] = useState(initialLastViewedAt);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = countUnread(notifications, lastViewedAt);
  const badgeLabel = unread > 9 ? "9+" : String(unread);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen && unread > 0) {
        setLastViewedAt(new Date().toISOString());
        void markNotificationsViewed();
      }
      return willOpen;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-ink-dim hover:bg-surface-sunken"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2.5c-2.2 0-4 1.8-4 4v2.3c0 .5-.2 1-.5 1.4L3.4 11.5A1 1 0 0 0 4.2 13h9.6a1 1 0 0 0 .8-1.5l-1.1-1.3a2 2 0 0 1-.5-1.4V6.5c0-2.2-1.8-4-4-4Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7.5 15a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium leading-none text-danger-soft-ink">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 max-h-80 overflow-y-auto rounded-md border border-line-strong bg-surface shadow-lg">
          {notifications.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-ink-faint">No notifications yet.</p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={buildNotificationHref(n)}
              onClick={() => setOpen(false)}
              className={`block border-l-4 px-3 py-2 text-sm hover:bg-surface-sunken ${
                n.kind === "review_decision"
                  ? n.decision === "approved"
                    ? "border-l-success text-ink"
                    : "border-l-danger text-ink"
                  : "border-l-transparent text-ink"
              }`}
            >
              {formatNotificationMessage(n)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update Header to fetch and render it**

Read `src/components/header.tsx` first to confirm current line numbers before editing.

Replace the whole `Header` function with:

```tsx
import { getGreeting, firstName } from "@/lib/greeting";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications/get-notifications";

export async function Header({ identity }: { identity: string }) {
  const greeting = getGreeting(new Date(), firstName(identity));
  const supabase = await createClient();
  const { notifications, lastViewedAt } = await getNotifications(supabase);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-8">
      <div>
        <p className="text-lg font-semibold text-ink">{greeting}</p>
        <p className="text-sm text-ink-dim">You&apos;re doing great — keep up the momentum.</p>
      </div>

      <div className="flex items-center gap-3">
        <HeaderSearch />
        <NotificationBell notifications={notifications} lastViewedAt={lastViewedAt} />
        <ThemeToggle />
      </div>
    </header>
  );
}
```

(`Header` becomes `async` here — this is safe: it's already rendered as plain JSX, `<Header identity={identity} />`, inside `async` server-component layouts in `src/app/app/layout.tsx`, `src/app/org/layout.tsx`, and `src/app/admin/layout.tsx`, which is exactly how other async Server Components in this codebase are already used.)

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/notification-bell.tsx src/components/header.tsx`
Expected: no errors. If `react-hooks/set-state-in-effect` or a similar rule flags anything, resolve it the same way `header-search.tsx` did: derive the flagged value at render time instead of setting it synchronously inside a `useEffect` body (the click-outside listener above only ever calls `setOpen` from an event callback, not from the effect body itself, so it should not trigger that rule — but verify).

- [ ] **Step 4: Commit**

```bash
git add src/components/notification-bell.tsx src/components/header.tsx
git commit -m "Wire up the notifications bell: badge, dropdown, mark-viewed on open"
```

---

### Task 6: Live verification

**Files:** none (throwaway verification script and throwaway test data only, not committed)

**Interfaces:**
- Consumes: the running dev server, and two throwaway draft modules created via SQL specifically for this task (owned by `demo.contentmanager@optymumss.com`, id `81047266-0943-4f21-b85b-94f9279abe21`) — one to be approved, one to be sent back for changes. Real demo content is never mutated by this task.
- Produces: nothing shipped — screenshots sent via `SendUserFile`, a pass/fail report, and full cleanup of the throwaway rows afterward.

- [ ] **Step 1: Create two throwaway draft modules**

Run via `mcp__Supabase__execute_sql` against project `uktdipvvnbgzasqlpudl`:

```sql
insert into public.modules (id, title, level, status, created_by)
values
  ('00000000-0000-4000-8000-000000000001', 'Notification Test Module (Approve Path)', 'beginner', 'draft', '81047266-0943-4f21-b85b-94f9279abe21'),
  ('00000000-0000-4000-8000-000000000002', 'Notification Test Module (Changes Path)', 'beginner', 'draft', '81047266-0943-4f21-b85b-94f9279abe21')
returning id, title;
```

Expected: 2 rows returned.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (background)
Wait for it to report ready (poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` until non-`000`).

- [ ] **Step 3: Write and run the verification script**

Write to `node_modules/.tmp-notifications-verify.mjs` (so Node resolves `playwright` from the project's own `node_modules`; launch Chromium with `args: ["--ignore-certificate-errors"]` — this sandbox's outbound HTTPS goes through a TLS-intercepting proxy that Playwright's ephemeral profile doesn't trust by default, the same fix Task 4 of the header-search plan needed):

```js
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "HemoDemo2026!";
const APPROVE_MODULE_ID = "00000000-0000-4000-8000-000000000001";
const CHANGES_MODULE_ID = "00000000-0000-4000-8000-000000000002";

async function loginAs(page, email) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--ignore-certificate-errors"],
});

// 1. Content manager submits both throwaway modules for review.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.contentmanager@optymumss.com");
  for (const id of [APPROVE_MODULE_ID, CHANGES_MODULE_ID]) {
    await page.goto(`${BASE_URL}/admin/modules/${id}`);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.waitForLoadState("networkidle");
  }
  await page.close();
}

// 2. Super admin sees a badge and the two submission_pending rows, decides both.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.superadmin@optymumss.com");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(500);

  const badge = await page.locator('button[aria-label="Notifications"] span').textContent().catch(() => null);
  console.log("super admin badge:", badge);
  if (!badge || Number(badge.replace("+", "")) < 1) {
    throw new Error(`FAIL: super admin should see an unread badge, got "${badge}"`);
  }

  await page.getByRole("button", { name: "Notifications" }).click();
  const dropdownText = await page.locator('a:has-text("Notification Test Module")').allTextContents();
  console.log("super admin dropdown:", dropdownText);
  if (!dropdownText.some((t) => t.includes("Notification Test Module (Approve Path)"))) {
    throw new Error("FAIL: super admin should see the approve-path submission");
  }
  if (!dropdownText.some((t) => t.includes("Notification Test Module (Changes Path)"))) {
    throw new Error("FAIL: super admin should see the changes-path submission");
  }

  await page.getByText("Notification Test Module (Approve Path)", { exact: false }).first().click();
  await page.waitForTimeout(2500); // client-side nav settle (known Playwright/Next timing quirk)
  if (!page.url().includes("/admin/review-queue")) {
    throw new Error(`FAIL: submission_pending link should go to /admin/review-queue, got ${page.url()}`);
  }

  // Decide both via the Review Queue's ReviewForm.
  const rows = page.locator("table tbody tr");
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const text = await row.textContent();
    if (text?.includes("Notification Test Module (Approve Path)")) {
      await row.getByRole("button", { name: "Approve & publish" }).click();
      await page.waitForLoadState("networkidle");
    }
  }
  await page.goto(`${BASE_URL}/admin/review-queue`);
  const rows2 = page.locator("table tbody tr");
  const rowCount2 = await rows2.count();
  for (let i = 0; i < rowCount2; i++) {
    const row = rows2.nth(i);
    const text = await row.textContent();
    if (text?.includes("Notification Test Module (Changes Path)")) {
      await row.getByRole("button", { name: "Request changes" }).click();
      await page.waitForLoadState("networkidle");
    }
  }
  await page.close();
}

// 3. Content manager sees both decisions with correct styling and links.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.contentmanager@optymumss.com");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Notifications" }).click();

  const approvedLink = page.getByText("Notification Test Module (Approve Path)\" was approved", { exact: false });
  const changesLink = page.getByText("Notification Test Module (Changes Path)\" needs changes", { exact: false });
  if (!(await approvedLink.isVisible().catch(() => false))) {
    throw new Error("FAIL: content manager should see the approved decision");
  }
  if (!(await changesLink.isVisible().catch(() => false))) {
    throw new Error("FAIL: content manager should see the changes_requested decision");
  }

  const approvedClass = await approvedLink.evaluate((el) => el.className);
  const changesClass = await changesLink.evaluate((el) => el.className);
  console.log("approved row class:", approvedClass);
  console.log("changes row class:", changesClass);
  if (!approvedClass.includes("border-l-success")) throw new Error("FAIL: approved row should be success-toned");
  if (!changesClass.includes("border-l-danger")) throw new Error("FAIL: changes_requested row should be danger-toned");

  await approvedLink.click();
  await page.waitForTimeout(2500);
  if (!page.url().includes(`/admin/modules/${APPROVE_MODULE_ID}`)) {
    throw new Error(`FAIL: review_decision link should go to the module's own page, got ${page.url()}`);
  }
  await page.close();
}

// 4. Badge clears after viewing.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.contentmanager@optymumss.com");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForTimeout(500);
  const badgeAfterReload = await page
    .locator('button[aria-label="Notifications"] span')
    .isVisible()
    .catch(() => false);
  if (badgeAfterReload) throw new Error("FAIL: badge should be cleared after viewing and reloading");
  console.log("badge correctly cleared after viewing");
  await page.close();
}

// 5. learner and org_admin see an empty bell throughout.
for (const email of ["demo.learner@optymumss.com", "demo.orgadmin@optymumss.com"]) {
  const page = await browser.newPage();
  await loginAs(page, email);
  await page.goto(email.includes("orgadmin") ? `${BASE_URL}/org` : `${BASE_URL}/app`);
  await page.waitForTimeout(500);
  const hasBadge = await page
    .locator('button[aria-label="Notifications"] span')
    .isVisible()
    .catch(() => false);
  if (hasBadge) throw new Error(`FAIL: ${email} should see no badge`);
  await page.getByRole("button", { name: "Notifications" }).click();
  const emptyState = await page.getByText("No notifications yet.").isVisible().catch(() => false);
  if (!emptyState) throw new Error(`FAIL: ${email} should see the empty state`);
  await page.close();
}

// 6. Screenshots: light, dark, mobile (super admin view, dropdown open).
{
  const page = await browser.newPage();
  await loginAs(page, "demo.superadmin@optymumss.com");
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.screenshot({ path: "/tmp/notifications-light.png" });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/notifications-dark.png" });
  await page.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await loginAs(mobilePage, "demo.superadmin@optymumss.com");
  await mobilePage.goto(`${BASE_URL}/admin`);
  await mobilePage.getByRole("button", { name: "Notifications" }).click();
  await mobilePage.screenshot({ path: "/tmp/notifications-mobile.png" });
  await mobilePage.close();
}

await browser.close();
console.log("ALL CHECKS PASSED");
```

Run: `node --env-file=.env.local node_modules/.tmp-notifications-verify.mjs`
Expected: `ALL CHECKS PASSED` printed. If any step's selector text doesn't match the actual rendered `ReviewForm` button labels, read `src/app/admin/review-queue/review-form.tsx` first and adjust the button-name strings above to match exactly — do not guess a second time blindly.

- [ ] **Step 4: Send screenshots**

Send `/tmp/notifications-light.png`, `/tmp/notifications-dark.png`, and `/tmp/notifications-mobile.png` via `SendUserFile`.

- [ ] **Step 5: Clean up**

Delete the throwaway script:

```bash
rm node_modules/.tmp-notifications-verify.mjs
```

Stop the dev server.

Delete all throwaway data via `mcp__Supabase__execute_sql`:

```sql
delete from public.notifications where content_id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);
delete from public.content_reviews where content_id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);
delete from public.modules where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);
```

Also reset the demo accounts' `notifications_last_viewed_at` so this verification leaves no lingering state:

```sql
update public.profiles set notifications_last_viewed_at = null
where email in ('demo.contentmanager@optymumss.com', 'demo.superadmin@optymumss.com');
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (121 pre-existing + 9 new from Task 2 = 130/130).

---

## Final check

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx vitest run` — 130/130 passing
- [ ] Live verification script printed `ALL CHECKS PASSED`
- [ ] Throwaway modules, their notifications/content_reviews rows, and the demo accounts' `notifications_last_viewed_at` cursors are all cleaned up
- [ ] Screenshots sent to the user
