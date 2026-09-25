# Supabase → Cloudflare D1 + Better Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Inline Execution, per AGENTS.md) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Supabase entirely. Postgres moves to **Cloudflare D1**, Supabase Auth moves to **Better Auth** (stored in D1), Supabase Storage moves to **R2**, and the security that Row Level Security (RLS) provides today moves into a tested authorization layer in the app. No user-visible behavior change; all 7 existing users keep their passwords.

**Prerequisite:** `docs/superpowers/plans/2026-09-25-vercel-to-cloudflare-migration.md` is fully complete (the app runs on Workers via vinext, deployed by Workers Builds). D1 bindings are only reachable from Workers.

**Architecture:** Three phases so that most work merges to `main` safely while Supabase is still live:

1. **Phase A — Extract (on `main`, Supabase still live).** Every database call moves out of pages/actions into domain repositories under `src/lib/data/`, which take an `Actor` and enforce explicit authorization (`src/lib/authz/`) that mirrors each RLS policy. RLS keeps running underneath as a safety net, so this phase can't weaken security. Supabase Storage moves to R2 in this phase too.
2. **Phase B — Build dormant infrastructure (on `main`, unused).** Drizzle schema for all 47 tables, D1 migrations, Better Auth config, and export/import scripts. Nothing calls them yet.
3. **Phase C — Switch (one short-lived branch `d1-cutover`, one PR).** Repository internals change from supabase-js to Drizzle/D1 (signatures unchanged, so pages don't change again), auth flows switch to Better Auth, Supabase packages are removed. Then a rehearsed cutover moves the data.

**Tech Stack:** Cloudflare D1, Drizzle ORM + drizzle-kit, Better Auth (Drizzle adapter), `bcryptjs` (verifying imported Supabase password hashes), `@libsql/client` (in-memory SQLite for tests), R2 via the existing `@aws-sdk/client-s3`, Vitest.

## Current Supabase footprint (measured 2026-09-25)

| Item | Count / size |
|---|---|
| Users (`auth.users`) | 7, email+password only, no OAuth, no MFA |
| Database | 15 MB, ~200 rows across 47 `public` tables |
| RLS policies | 163 (7 recurring patterns — see Task A1) |
| SQL functions | 18: 4 authz helpers, 3 auth triggers, 1 role-escalation trigger, 7 RPCs, 3 misc |
| RPCs called from the app | `platform_org_summary`, `org_dashboard_kpis`, `org_at_risk_learners`, `org_weakest_modules`, `org_onboarding_completion`, `org_daily_activity_counts`, `find_profile_id_by_email` |
| Full-text search | `textSearch(..., { type: "websearch" })` in `src/lib/tutor/retrieve-context.ts` (3 queries) |
| Storage | bucket `feature-images` (private, 3 objects, 142 kB), bucket `slides` (legacy, 1 object, 11 kB) |
| Files using a Supabase client | 156 (38 of them touch `auth.*`) |
| Browser-side Supabase use | 4 files: two feature forms (storage upload), `auth/confirm/hash-fragment-fallback.tsx`, `lib/search/search-content.ts` |
| Supabase Edge Functions | **0** — nothing to migrate |
| Realtime | not used |

## Global Constraints

- **Security parity is the top requirement.** Every RLS policy has a matching `authz` rule with a unit test, and every repository function checks it. A repository function that writes data without an `authz` check is a bug.
- **Stable IDs.** All existing UUIDs, including user ids, are preserved exactly. New ids are `crypto.randomUUID()`.
- **Timestamps stay ISO-8601 strings** (`2026-09-25T12:34:56.789Z`), stored as `text` in D1 with default `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`. Existing code that compares or sorts timestamp strings keeps working.
- **Type mapping (Postgres → D1):** `uuid`/`text`/`citext` → `text`; enum → `text` with an enum type in Drizzle and a `CHECK` constraint; `boolean` → `integer({ mode: "boolean" })`; `int`/`bigint` → `integer`; `numeric` → `real`; `jsonb`/arrays → `text({ mode: "json" })`; FK `on delete cascade/set null` preserved; unique constraints and indexes preserved.
- **D1 has no interactive transactions.** Never use `db.transaction(...)`. Multi-statement writes use `db.batch([...])`, which is atomic.
- **Only repositories touch the database.** After Task A11, ESLint forbids importing `@/lib/supabase/*` (Phase A) or `@/db` (Phase C) outside `src/lib/data/**`, `src/lib/auth/**` and `src/db/**`.
- **Passwords are never reset or re-hashed in bulk.** Imported bcrypt hashes are verified with bcrypt; new passwords use Better Auth's default scrypt.
- `compatibility_date` / flags follow the Vercel→Cloudflare plan (`2026-09-25`, `nodejs_compat`).
- D1 database name: `hemoedge`; binding: `DB`. Private R2 bucket: `hemoedge-private`; binding-free, accessed via the existing S3 client with a second bucket name `R2_PRIVATE_BUCKET_NAME`.

## File Map

| Path | Phase | Responsibility |
|---|---|---|
| `supabase/rls-snapshot.json` | A | Frozen export of all 163 policies — the spec for `authz` |
| `src/lib/authz/actor.ts` | A | `Actor` type + `getActor()` (request-cached) |
| `src/lib/authz/policies.ts` + `.test.ts` | A | Pure functions mirroring every RLS pattern |
| `src/lib/authz/errors.ts` | A | `ForbiddenError`, `assertAllowed()` |
| `src/lib/data/<domain>.ts` | A (supabase-js) → C (Drizzle) | Repositories: the only DB access |
| `src/lib/storage/private-objects.ts` | A | Presigned GET/PUT/DELETE for the private R2 bucket |
| `scripts/storage/copy-supabase-storage-to-r2.mjs` | A | One-off copy of 4 Storage objects |
| `src/db/schema/*.ts` | B | Drizzle `sqlite-core` schema (app tables + Better Auth tables) |
| `drizzle.config.ts`, `drizzle/migrations/*.sql` | B | Generated D1 migrations (+ one custom FTS5 migration) |
| `src/db/index.ts` | B | `getDb()` — Drizzle over the `DB` binding |
| `src/db/test-db.ts` | B | `createTestDb()` — in-memory libsql with migrations applied |
| `src/db/schema-parity.test.ts` + `scripts/d1/pg-columns.json` | B | Proves every Postgres column exists in D1 |
| `src/lib/auth/better-auth.ts` | B | Better Auth instance (`getAuth()`) |
| `src/lib/auth/password.ts` + `.test.ts` | B | bcrypt-or-scrypt password verify |
| `src/lib/auth/new-user-profile.ts` + `.test.ts` | B | Port of `handle_new_user()` |
| `src/app/api/auth/[...all]/route.ts` | C | Better Auth HTTP handler |
| `scripts/d1/export-supabase.mjs`, `scripts/d1/build-import-sql.mjs` | B | Data export → SQL import file |
| `src/lib/supabase/*`, `@supabase/*` deps | C | Deleted |

---

## Phase A — Extract data access and authorization (merge to `main` task by task)

### Task A1: Actor and the authorization policy module

**Files:**
- Create: `supabase/rls-snapshot.json`, `src/lib/authz/actor.ts`, `src/lib/authz/policies.ts`, `src/lib/authz/policies.test.ts`, `src/lib/authz/errors.ts`

**Interfaces:**
- Produces (used by every later task):
  - `type Actor = { id: string; role: AppRole; orgAdminOf: ReadonlySet<string>; memberOf: ReadonlySet<string>; contentScopes: ReadonlySet<string> }` (`contentScopes` entries are `` `${ContentType}:${contentId}` ``)
  - `type ContentType = "modules" | "cases" | "slides" | "features" | "curricula" | "wbc_diff_exercise" | "cell_id_exercise"`
  - `type ContentStatus = "draft" | "in_review" | "changes_requested" | "published"` (verify against the `content_status` enum in `database.types.ts`; add any extra value found)
  - `getActor(): Promise<Actor | null>` — cached per request with React `cache()`
  - policy functions listed in Step 3
  - `assertAllowed(allowed: boolean, message?: string): asserts allowed` — throws `ForbiddenError`

- [ ] **Step 1: Freeze the RLS spec**

Run in the Supabase SQL editor (or via the Supabase MCP `execute_sql`) and save the JSON result to `supabase/rls-snapshot.json`:

```sql
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
```

Expected: 163 rows. This file is the reference every `authz` test cites; it is deleted with the rest of `supabase/` in Task C6.

- [ ] **Step 2: Write the failing tests**

`src/lib/authz/policies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Actor } from "./actor";
import {
  isSuperAdmin, isOrgAdmin, canManageContent,
  canReadAuthored, canInsertAuthored, canUpdateAuthored, canDeleteSlide,
  canReadChildOfAuthored, canWriteChildOfAuthored,
  canReadTaxonomy, canWriteTaxonomy,
  canReadLearnerRecord, canInsertOwnRecord,
  canReadAttemptAsAuthor,
  canManageOrgMembership, canReadOrgScoped, canWriteOrgScoped,
  canReadPublicCms, canWriteCms,
  canUpdateOwnProfile, canReadProfile,
} from "./policies";

function actor(over: Partial<Actor> = {}): Actor {
  return {
    id: "u1", role: "member",
    orgAdminOf: new Set(), memberOf: new Set(), contentScopes: new Set(),
    ...over,
  };
}
const superAdmin = actor({ id: "sa", role: "super_admin" });
const cm = actor({ id: "cm", role: "content_manager" });
const otherCm = actor({ id: "cm2", role: "content_manager" });

describe("helper functions (ports of is_super_admin / is_org_admin / can_manage_content)", () => {
  it("isSuperAdmin", () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(cm)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
  it("isOrgAdmin is true only for owner/admin memberships", () => {
    expect(isOrgAdmin(actor({ orgAdminOf: new Set(["o1"]) }), "o1")).toBe(true);
    expect(isOrgAdmin(actor({ memberOf: new Set(["o1"]) }), "o1")).toBe(false);
  });
  it("canManageContent: super admin, the authoring content manager, or a scoped content manager", () => {
    const row = { id: "m1", created_by: "cm" };
    expect(canManageContent(superAdmin, "modules", row)).toBe(true);
    expect(canManageContent(cm, "modules", row)).toBe(true);
    expect(canManageContent(otherCm, "modules", row)).toBe(false);
    expect(canManageContent(actor({ id: "cm2", role: "content_manager", contentScopes: new Set(["modules:m1"]) }), "modules", row)).toBe(true);
    // an author who is no longer a content manager loses access
    expect(canManageContent(actor({ id: "cm", role: "member" }), "modules", row)).toBe(false);
  });
});

describe("authored content (modules, cases, slides, features, curricula, wbc_diff_exercises, cell_id_exercises)", () => {
  const draft = { id: "m1", created_by: "cm", status: "draft" as const };
  const published = { ...draft, status: "published" as const };
  it("read: published to everyone incl. anonymous; drafts only to author and super admin", () => {
    expect(canReadAuthored(null, published)).toBe(true);
    expect(canReadAuthored(null, draft)).toBe(false);
    expect(canReadAuthored(cm, draft)).toBe(true);
    expect(canReadAuthored(otherCm, draft)).toBe(false);
    expect(canReadAuthored(superAdmin, draft)).toBe(true);
  });
  it("insert: content manager creating their own draft; super admin anything", () => {
    expect(canInsertAuthored(cm, { created_by: "cm", status: "draft" })).toBe(true);
    expect(canInsertAuthored(cm, { created_by: "cm", status: "published" })).toBe(false);
    expect(canInsertAuthored(cm, { created_by: "someone-else", status: "draft" })).toBe(false);
    expect(canInsertAuthored(actor(), { created_by: "u1", status: "draft" })).toBe(false);
    expect(canInsertAuthored(superAdmin, { created_by: "x", status: "published" })).toBe(true);
  });
  it("update: manager of a draft/changes_requested row may move it to draft/changes_requested/in_review", () => {
    expect(canUpdateAuthored(cm, "modules", draft, { status: "in_review" })).toBe(true);
    expect(canUpdateAuthored(cm, "modules", draft, { status: "published" })).toBe(false);
    expect(canUpdateAuthored(cm, "modules", { ...draft, status: "in_review" }, { status: "draft" })).toBe(false);
    expect(canUpdateAuthored(superAdmin, "modules", published, { status: "draft" })).toBe(true);
  });
  it("slides delete: manager while draft/changes_requested, or super admin", () => {
    expect(canDeleteSlide(cm, { id: "s1", created_by: "cm", status: "draft" })).toBe(true);
    expect(canDeleteSlide(cm, { id: "s1", created_by: "cm", status: "published" })).toBe(false);
    expect(canDeleteSlide(superAdmin, { id: "s1", created_by: "cm", status: "published" })).toBe(true);
  });
});

describe("children of authored content (lessons, *_tags, module_prerequisites, quiz_questions, case_*, slide_annotations, *_hotspots)", () => {
  const parentDraft = { id: "m1", created_by: "cm", status: "draft" as const };
  it("read follows parent being published, else author/super admin", () => {
    expect(canReadChildOfAuthored(null, { ...parentDraft, status: "published" })).toBe(true);
    expect(canReadChildOfAuthored(otherCm, parentDraft)).toBe(false);
    expect(canReadChildOfAuthored(cm, parentDraft)).toBe(true);
  });
  it("write: parent's author (any status) or super admin", () => {
    expect(canWriteChildOfAuthored(cm, parentDraft)).toBe(true);
    expect(canWriteChildOfAuthored(cm, { ...parentDraft, status: "published" })).toBe(true);
    expect(canWriteChildOfAuthored(otherCm, parentDraft)).toBe(false);
    expect(canWriteChildOfAuthored(superAdmin, parentDraft)).toBe(true);
  });
});

describe("taxonomy (tags, cell_types, slide_categories, curriculum_modules; tiers)", () => {
  it("read: any signed-in user", () => {
    expect(canReadTaxonomy(actor())).toBe(true);
    expect(canReadTaxonomy(null)).toBe(false);
  });
  it("write: super admin or content manager; tiers super admin only", () => {
    expect(canWriteTaxonomy(cm, "tags")).toBe(true);
    expect(canWriteTaxonomy(actor(), "tags")).toBe(false);
    expect(canWriteTaxonomy(cm, "tiers")).toBe(false);
    expect(canWriteTaxonomy(superAdmin, "tiers")).toBe(true);
  });
});

describe("learner records (quiz_attempts, certificates, *_attempts, slide_views, case_report_submissions)", () => {
  const rec = { user_id: "u1" };
  it("owner reads; org admin of a shared org reads; super admin reads", () => {
    expect(canReadLearnerRecord(actor(), rec, new Set())).toBe(true);
    expect(canReadLearnerRecord(actor({ id: "boss", orgAdminOf: new Set(["o1"]) }), rec, new Set(["o1"]))).toBe(true);
    expect(canReadLearnerRecord(actor({ id: "boss", orgAdminOf: new Set(["o2"]) }), rec, new Set(["o1"]))).toBe(false);
    expect(canReadLearnerRecord(superAdmin, rec, new Set())).toBe(true);
  });
  it("insert only for yourself", () => {
    expect(canInsertOwnRecord(actor(), rec)).toBe(true);
    expect(canInsertOwnRecord(actor({ id: "u2" }), rec)).toBe(false);
  });
  it("exercise authors can read attempts on their exercises", () => {
    expect(canReadAttemptAsAuthor(cm, { created_by: "cm" })).toBe(true);
    expect(canReadAttemptAsAuthor(otherCm, { created_by: "cm" })).toBe(false);
  });
});

describe("organizations", () => {
  const orgAdmin = actor({ id: "oa", role: "org_admin", orgAdminOf: new Set(["o1"]), memberOf: new Set(["o1"]) });
  it("org admins manage member/admin rows but never owners, and may only insert/delete plain members", () => {
    expect(canManageOrgMembership(orgAdmin, "insert", { org_id: "o1", org_role: "member" })).toBe(true);
    expect(canManageOrgMembership(orgAdmin, "insert", { org_id: "o1", org_role: "admin" })).toBe(false);
    expect(canManageOrgMembership(orgAdmin, "update", { org_id: "o1", org_role: "admin" })).toBe(true);
    expect(canManageOrgMembership(orgAdmin, "update", { org_id: "o1", org_role: "owner" })).toBe(false);
    expect(canManageOrgMembership(orgAdmin, "delete", { org_id: "o1", org_role: "admin" })).toBe(false);
    expect(canManageOrgMembership(orgAdmin, "insert", { org_id: "o2", org_role: "member" })).toBe(false);
  });
  it("org-scoped rows readable by members, writable by org admins", () => {
    expect(canReadOrgScoped(actor({ memberOf: new Set(["o1"]) }), "o1")).toBe(true);
    expect(canReadOrgScoped(actor(), "o1")).toBe(false);
    expect(canWriteOrgScoped(orgAdmin, "o1")).toBe(true);
    expect(canWriteOrgScoped(actor({ memberOf: new Set(["o1"]) }), "o1")).toBe(false);
  });
});

describe("public CMS (pages, blog_posts, testimonials, associates, site_settings)", () => {
  it("published rows public; writes super admin only", () => {
    expect(canReadPublicCms(null, { published: true })).toBe(true);
    expect(canReadPublicCms(null, { published: false })).toBe(false);
    expect(canReadPublicCms(superAdmin, { published: false })).toBe(true);
    expect(canWriteCms(cm)).toBe(false);
    expect(canWriteCms(superAdmin)).toBe(true);
  });
});

describe("profiles (includes prevent_self_role_escalation)", () => {
  it("users update their own profile but never their own role", () => {
    expect(canUpdateOwnProfile(actor(), { id: "u1" }, { full_name: "New" })).toBe(true);
    expect(canUpdateOwnProfile(actor(), { id: "u1" }, { role: "super_admin" })).toBe(false);
    expect(canUpdateOwnProfile(actor(), { id: "u2" }, { full_name: "x" })).toBe(false);
    expect(canUpdateOwnProfile(superAdmin, { id: "u2" }, { role: "content_manager" })).toBe(true);
  });
  it("profiles readable by self, org admins of a shared org, super admin", () => {
    expect(canReadProfile(actor(), { id: "u1" }, new Set())).toBe(true);
    expect(canReadProfile(actor({ id: "oa", orgAdminOf: new Set(["o1"]) }), { id: "u1" }, new Set(["o1"]))).toBe(true);
    expect(canReadProfile(actor({ id: "x" }), { id: "u1" }, new Set(["o1"]))).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/authz/policies.test.ts`
Expected: FAIL — `Cannot find module './policies'`.

- [ ] **Step 4: Implement**

`src/lib/authz/errors.ts`:

```ts
export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertAllowed(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw new ForbiddenError(message);
}
```

`src/lib/authz/actor.ts`:

```ts
import { cache } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { loadActorGrants } from "@/lib/data/identity";

export type ContentType =
  | "modules" | "cases" | "slides" | "features" | "curricula" | "wbc_diff_exercise" | "cell_id_exercise";

export type ContentStatus = "draft" | "in_review" | "changes_requested" | "published";

export type Actor = {
  id: string;
  role: AppRole;
  /** org ids where this user's membership is owner or admin (is_org_admin) */
  orgAdminOf: ReadonlySet<string>;
  /** every org id this user belongs to */
  memberOf: ReadonlySet<string>;
  /** `${ContentType}:${contentId}` rows from content_scopes for this user */
  contentScopes: ReadonlySet<string>;
};

/** The signed-in user plus the grants RLS used to look up per row. Loaded
 * once per request. Always the *real* user — impersonation changes whose
 * data is shown (getEffectiveUserId), never who is authorized. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const grants = await loadActorGrants(profile.id);
  return { id: profile.id, role: profile.role, ...grants };
});
```

(`loadActorGrants` is created in Task A2, Step 3; write `actor.ts` now and it type-checks once A2 lands — A1 and A2 are committed together if you prefer a green build per commit.)

`src/lib/authz/policies.ts`:

```ts
import type { Actor, ContentStatus, ContentType } from "./actor";

type Authored = { id: string; created_by: string | null; status: ContentStatus };
const EDITABLE: ContentStatus[] = ["draft", "changes_requested"];
const EDITABLE_TARGET: ContentStatus[] = ["draft", "changes_requested", "in_review"];

// ---- helper functions (is_super_admin, is_org_admin, can_manage_content) ----
export const isSuperAdmin = (a: Actor | null): a is Actor => a?.role === "super_admin";
export const isContentManager = (a: Actor | null): a is Actor => a?.role === "content_manager";
export const isOrgAdmin = (a: Actor | null, orgId: string) => !!a && a.orgAdminOf.has(orgId);

export function canManageContent(a: Actor | null, type: ContentType, row: { id: string; created_by: string | null }) {
  if (!a) return false;
  return (
    isSuperAdmin(a) ||
    (row.created_by === a.id && isContentManager(a)) ||
    a.contentScopes.has(`${type}:${row.id}`)
  );
}

// ---- authored content ----
export function canReadAuthored(a: Actor | null, row: Authored) {
  return row.status === "published" || isSuperAdmin(a) || (!!a && row.created_by === a.id);
}
export function canInsertAuthored(a: Actor | null, row: { created_by: string | null; status: ContentStatus }) {
  return isSuperAdmin(a) || (isContentManager(a) && row.created_by === a.id && row.status === "draft");
}
export function canUpdateAuthored(a: Actor | null, type: ContentType, before: Authored, after: { status?: ContentStatus }) {
  if (isSuperAdmin(a)) return true;
  const targetStatus = after.status ?? before.status;
  return canManageContent(a, type, before) && EDITABLE.includes(before.status) && EDITABLE_TARGET.includes(targetStatus);
}
export function canDeleteSlide(a: Actor | null, row: Authored) {
  return isSuperAdmin(a) || (canManageContent(a, "slides", row) && EDITABLE.includes(row.status));
}

// ---- children of authored content ----
export function canReadChildOfAuthored(a: Actor | null, parent: Authored) {
  return parent.status === "published" || isSuperAdmin(a) || (!!a && parent.created_by === a.id);
}
export function canWriteChildOfAuthored(a: Actor | null, parent: { created_by: string | null }) {
  return isSuperAdmin(a) || (!!a && parent.created_by === a.id);
}

// ---- taxonomy ----
export type TaxonomyTable = "tags" | "cell_types" | "slide_categories" | "curriculum_modules" | "tiers";
export const canReadTaxonomy = (a: Actor | null) => !!a;
export function canWriteTaxonomy(a: Actor | null, table: TaxonomyTable) {
  if (table === "tiers") return isSuperAdmin(a);
  return isSuperAdmin(a) || isContentManager(a);
}

// ---- learner records ----
/** `recordOwnerOrgIds`: orgs the record's user belongs to (the RLS EXISTS on organization_memberships). */
export function canReadLearnerRecord(a: Actor | null, row: { user_id: string }, recordOwnerOrgIds: ReadonlySet<string>) {
  if (!a) return false;
  if (isSuperAdmin(a) || row.user_id === a.id) return true;
  for (const org of recordOwnerOrgIds) if (a.orgAdminOf.has(org)) return true;
  return false;
}
export const canInsertOwnRecord = (a: Actor | null, row: { user_id: string }) =>
  isSuperAdmin(a) || (!!a && row.user_id === a.id);
export const canReadAttemptAsAuthor = (a: Actor | null, exercise: { created_by: string | null }) =>
  !!a && exercise.created_by === a.id;

// ---- organizations ----
export function canManageOrgMembership(
  a: Actor | null,
  op: "insert" | "update" | "delete",
  row: { org_id: string; org_role: "owner" | "admin" | "member" },
) {
  if (isSuperAdmin(a)) return true;
  if (!isOrgAdmin(a, row.org_id)) return false;
  if (op === "update") return row.org_role === "member" || row.org_role === "admin";
  return row.org_role === "member";
}
export const canReadOrgScoped = (a: Actor | null, orgId: string) =>
  isSuperAdmin(a) || (!!a && a.memberOf.has(orgId));
export const canWriteOrgScoped = (a: Actor | null, orgId: string) => isSuperAdmin(a) || isOrgAdmin(a, orgId);

// ---- public CMS ----
export const canReadPublicCms = (a: Actor | null, row: { published: boolean }) => row.published || isSuperAdmin(a);
export const canWriteCms = (a: Actor | null) => isSuperAdmin(a);

// ---- profiles ----
export function canUpdateOwnProfile(a: Actor | null, row: { id: string }, patch: { role?: string; [k: string]: unknown }) {
  if (isSuperAdmin(a)) return true;
  return !!a && row.id === a.id && patch.role === undefined;
}
export function canReadProfile(a: Actor | null, row: { id: string }, profileOrgIds: ReadonlySet<string>) {
  if (!a) return false;
  if (isSuperAdmin(a) || row.id === a.id) return true;
  for (const org of profileOrgIds) if (a.orgAdminOf.has(org)) return true;
  return false;
}
```

Notes for the implementer: `pages`/`blog_posts` use `status = 'published'` (text) and `testimonials` uses `published = true` — callers map both to `{ published: boolean }`. `associates` and `site_settings` are readable by everyone (`true`); `enquiries` insert is open to everyone (anonymous contact form).

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/authz/policies.test.ts`
Expected: all tests pass.

- [ ] **Step 6: Commit** (together with Task A2 if `actor.ts` doesn't type-check yet)

```bash
git add supabase/rls-snapshot.json src/lib/authz
git commit -m "Add authorization policies mirroring Supabase RLS"
```

---

### Task A2: Repository pattern — worked example on `slide_categories` + actor grants

This task sets the pattern every other domain copies. It uses supabase-js internally (RLS still active).

**Files:**
- Create: `src/lib/data/taxonomy.ts`, `src/lib/data/identity.ts`
- Modify: `src/app/admin/slide-categories/actions.ts`, `src/app/admin/slide-categories/page.tsx`, `src/app/admin/slides/page.tsx`

**Interfaces:**
- Consumes: `Actor`, `getActor`, `canReadTaxonomy`, `canWriteTaxonomy`, `assertAllowed` (A1).
- Produces:
  - `loadActorGrants(userId: string): Promise<Pick<Actor, "orgAdminOf" | "memberOf" | "contentScopes">>`
  - `type SlideCategory = { id: string; name: string; slug: string; description: string | null; parent_id: string | null }`
  - `listSlideCategories(actor: Actor | null): Promise<SlideCategory[]>` (ordered by name)
  - `createSlideCategory(actor: Actor | null, input: { name: string; parentId: string | null; description: string | null }): Promise<void>`
  - `updateSlideCategory(actor: Actor | null, id: string, input: { name: string; parentId: string | null; description: string | null }): Promise<void>`
  - `deleteSlideCategory(actor: Actor | null, id: string): Promise<void>`
  - Repository errors: throw `ForbiddenError` for authz failures, `Error(message)` for DB errors.

**Repository rules (apply to every domain task):**
1. One exported function per distinct query the app runs; name it `<verb><Noun>` (`list…`, `get…`, `create…`, `update…`, `delete…`, `count…`). Return plain typed objects, never supabase response objects.
2. First line of every function: `assertAllowed(<policy>(actor, …))` for writes; for reads either the same, or (for lists) a filter that encodes the policy (in Phase A, RLS does the filtering; add the explicit filter in Phase C).
3. The DB handle is obtained **inside** the repository (`await createClient()` now; `getDb()` in Phase C) — callers never see it. That's what makes Phase C a body-only change.
4. Callers (pages/actions) call `getActor()` and pass it in, translate `ForbiddenError` into their existing error shape, and keep their existing `revalidatePath` calls.

- [ ] **Step 1: Write the repository**

`src/lib/data/identity.ts` (only the grants loader for now; Task A10 adds the rest):

```ts
import { createClient } from "@/lib/supabase/server";
import type { Actor } from "@/lib/authz/actor";

export async function loadActorGrants(
  userId: string,
): Promise<Pick<Actor, "orgAdminOf" | "memberOf" | "contentScopes">> {
  const supabase = await createClient();
  const [{ data: memberships }, { data: scopes }] = await Promise.all([
    supabase.from("organization_memberships").select("org_id, org_role").eq("user_id", userId),
    supabase.from("content_scopes").select("content_type, content_id").eq("content_manager_id", userId),
  ]);
  return {
    memberOf: new Set((memberships ?? []).map((m) => m.org_id)),
    orgAdminOf: new Set(
      (memberships ?? []).filter((m) => m.org_role === "owner" || m.org_role === "admin").map((m) => m.org_id),
    ),
    contentScopes: new Set((scopes ?? []).map((s) => `${s.content_type}:${s.content_id}`)),
  };
}
```

`src/lib/data/taxonomy.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import type { Actor } from "@/lib/authz/actor";
import { assertAllowed } from "@/lib/authz/errors";
import { canReadTaxonomy, canWriteTaxonomy } from "@/lib/authz/policies";
import { slugify } from "@/lib/slugify";

export type SlideCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
};

type SlideCategoryInput = { name: string; parentId: string | null; description: string | null };

export async function listSlideCategories(actor: Actor | null): Promise<SlideCategory[]> {
  assertAllowed(canReadTaxonomy(actor));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slide_categories")
    .select("id, name, slug, description, parent_id")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSlideCategory(actor: Actor | null, input: SlideCategoryInput): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  const supabase = await createClient();
  const { error } = await supabase.from("slide_categories").insert({
    name: input.name,
    slug: slugify(input.name),
    parent_id: input.parentId,
    description: input.description,
  });
  if (error) throw new Error(error.message);
}

export async function updateSlideCategory(actor: Actor | null, id: string, input: SlideCategoryInput): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("slide_categories")
    .update({ name: input.name, slug: slugify(input.name), parent_id: input.parentId, description: input.description })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSlideCategory(actor: Actor | null, id: string): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  const supabase = await createClient();
  const { error } = await supabase.from("slide_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Switch the callers**

`src/app/admin/slide-categories/actions.ts` — replace the supabase import with repository calls; keep validation and `revalidatePath` exactly as today:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/authz/actor";
import * as taxonomy from "@/lib/data/taxonomy";

export type FormState = { error?: string } | undefined;

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export async function createSlideCategory(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Name is required." };

  try {
    await taxonomy.createSlideCategory(await getActor(), { name, parentId, description });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/admin/slide-categories");
  return undefined;
}

export async function updateSlideCategory(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id || !name) return { error: "Name is required." };
  if (parentId === id) return { error: "A category can't be its own parent." };

  try {
    await taxonomy.updateSlideCategory(await getActor(), id, { name, parentId, description });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/admin/slide-categories");
  return undefined;
}

export async function deleteSlideCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await taxonomy.deleteSlideCategory(await getActor(), id);
  revalidatePath("/admin/slide-categories");
}
```

`src/app/admin/slide-categories/page.tsx` — replace the first 6 lines of the component body with:

```ts
import { getActor } from "@/lib/authz/actor";
import { listSlideCategories } from "@/lib/data/taxonomy";
// ...
export default async function SlideCategoriesPage() {
  const categories = await listSlideCategories(await getActor());
```

(and drop the `?? []` fallbacks below, since the function always returns an array). In `src/app/admin/slides/page.tsx`, replace its `from("slide_categories")` query with `await listSlideCategories(actor)` the same way.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: all pass.
Manual (`npm run dev`): as a content manager, create/rename/delete a slide category on `/admin/slide-categories`; as a member, the page is unreachable (proxy) and a direct server-action call returns "You don't have permission to do that."

- [ ] **Step 4: Commit**

```bash
git add src/lib/data src/app/admin/slide-categories src/app/admin/slides/page.tsx
git commit -m "Route slide category access through a taxonomy repository"
```

---

### Tasks A3–A10: Extract the remaining domains

Each task below follows the same five steps, written out here once so each task can be executed on its own:

1. **Inventory.** For every file listed, `grep -n 'from("<table>")\|\.rpc(\|\.storage' <file>` for the domain's tables and write down each distinct query.
2. **Repository.** In `src/lib/data/<domain>.ts`, add one function per distinct query following the Repository rules in Task A2, guarding it with the policy functions named in the task.
3. **Tests.** For every write function, add a test in `src/lib/data/<domain>.authz.test.ts` that mocks `@/lib/supabase/server` (`vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))`) and asserts that an unauthorized actor gets `ForbiddenError` **before** `createClient` is called. Example to copy for each write function:

   ```ts
   import { describe, it, expect, vi } from "vitest";
   import { createClient } from "@/lib/supabase/server";
   import { ForbiddenError } from "@/lib/authz/errors";
   import { createSlideCategory } from "./taxonomy";

   vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

   const member = { id: "u1", role: "member" as const, orgAdminOf: new Set<string>(), memberOf: new Set<string>(), contentScopes: new Set<string>() };

   describe("taxonomy writes", () => {
     it("rejects a member before touching the database", async () => {
       await expect(createSlideCategory(member, { name: "x", parentId: null, description: null })).rejects.toBeInstanceOf(ForbiddenError);
       expect(createClient).not.toHaveBeenCalled();
     });
   });
   ```
4. **Callers.** Replace each query in the listed files with the repository call (`getActor()` once per action/page). Keep error messages, redirects and `revalidatePath` calls unchanged.
5. **Verify + commit.** `npx tsc --noEmit && npm run lint && npm run test && npm run build`, click through the listed pages as each affected role, then commit `Route <domain> access through a repository`.

Files that touch several domains are edited in several tasks — each task only replaces its own tables' queries.

#### Task A3: Taxonomy (rest) — `tags`, `cell_types`, `curriculum_modules`, `tiers`
- Policies: `canReadTaxonomy`, `canWriteTaxonomy` (tiers: super admin only).
- Repository: `src/lib/data/taxonomy.ts` (extend).
- Files: `src/app/admin/cases/[id]/actions.ts`, `src/app/admin/cases/[id]/page.tsx`, `src/app/admin/cell-id/[id]/pins/page.tsx`, `src/app/admin/cell-types/actions.ts`, `src/app/admin/cell-types/page.tsx`, `src/app/admin/features/[id]/edit/page.tsx`, `src/app/admin/features/new/page.tsx`, `src/app/admin/modules/[id]/actions.ts`, `src/app/admin/modules/[id]/page.tsx`, `src/app/admin/wbc-diff/[id]/hotspots/page.tsx`, `src/app/app/cell-id/[id]/page.tsx`, `src/app/admin/tiers/actions.ts`, `src/app/admin/tiers/page.tsx`, `src/app/org/billing/page.tsx`.

#### Task A4: Content core — `modules`, `lessons`, `module_tags`, `module_prerequisites`, `quiz_questions`, `curricula`
- Policies: parents (`modules`, `curricula`): `canReadAuthored`, `canInsertAuthored`, `canUpdateAuthored`, super admin for delete. Children: `canReadChildOfAuthored` / `canWriteChildOfAuthored` against the parent row (load the parent first). `quiz_questions` has two possible parents (`module_id` or `case_id`) — check whichever is set.
- Repository: `src/lib/data/content.ts`.
- Files: `src/app/admin/cases/[id]/quiz/actions.ts`, `src/app/admin/cases/[id]/quiz/page.tsx`, `src/app/admin/curricula/**` (5 files), `src/app/admin/modules/**` (9 files), `src/app/app/modules/[id]/{actions,page}.tsx`, `src/app/app/page.tsx`, `src/app/app/pathways/page.tsx`, `src/app/org/catalog/page.tsx`, `src/app/org/onboarding/[id]/page.tsx`, `src/lib/learner/{certificate-progress,get-fallback-preview-slide,get-study-recommendation}.ts`, `src/lib/media/content-media.ts`, `src/lib/org/onboarding-progress.ts`, `src/lib/quiz/{certificates,pass-threshold}.ts`, `src/lib/search/search-content.ts`, `src/lib/trends/get-dashboard-trends.ts`.
- `src/lib/search/search-content.ts` currently runs in the **browser** with the anon key. Move it behind a server action `searchContent(query)` in `src/lib/data/content.ts` and call that from `src/components/header-search.tsx`, so no browser code queries the database.

#### Task A5: Cases — `cases`, `case_features`, `case_modules`, `case_slides`, `case_tags`, `case_report_submissions`
- Policies: authored (`cases`), child-of-authored (the four link tables), learner record (`case_report_submissions`: `canInsertOwnRecord`, owner/super-admin read).
- Repository: `src/lib/data/cases.ts`.
- Files: `src/app/admin/cases/**` (6 files), `src/app/app/cases/**` (3 files), `src/lib/learner/competency-rows.ts`, and the `cases` queries in files shared with Task A4.

#### Task A6: Slides and tiling — `slides`, `slide_annotations`, `slide_views`, `tiling_jobs`
- Policies: authored + `canDeleteSlide`; child-of-authored (`slide_annotations`); learner record (`slide_views`, owner or super admin, all ops); `tiling_jobs`: `canManageContent(actor, "slides", slide)` for select/insert/update.
- `src/app/api/tiling/callback/route.ts` has no user — it calls a dedicated `markTilingResult(jobId, slideId, result)` that is **not** actor-guarded; it's authenticated by the callback secret (unchanged), same as its current service-role use.
- Repository: `src/lib/data/slides.ts`.
- Files: `src/app/admin/slides/**`, `src/app/app/library/**`, `src/app/admin/cases/new/page.tsx`, `src/app/admin/cell-id/page.tsx`, `src/app/admin/wbc-diff/page.tsx`, `src/lib/slides/{get-slide-annotations,get-slide-view-url,record-slide-view}.ts`, `src/lib/tiling/reconcile-stale-jobs.ts`, `src/app/api/tiling/callback/route.ts`, plus `slides` queries in shared files.

#### Task A7: Exercises — `wbc_diff_exercises`, `wbc_diff_hotspots`, `wbc_diff_attempts`, `cell_id_exercises`, `cell_id_hotspots`, `cell_id_attempts`
- Policies: authored (`*_exercises`, content types `wbc_diff_exercise` / `cell_id_exercise`), child-of-authored (`*_hotspots`), attempts: `canInsertOwnRecord`, read if owner, `canReadAttemptAsAuthor` (exercise author), or super admin.
- Repository: `src/lib/data/exercises.ts`.
- Files: `src/app/admin/cell-id/**`, `src/app/admin/wbc-diff/**`, `src/app/app/cell-id/**`, `src/app/app/wbc-diff/**`, `src/app/app/cases/[id]/page.tsx`, `src/app/app/modules/[id]/page.tsx`, `src/lib/learner/{competency-rows,get-study-recommendation}.ts`.

#### Task A8: Features, review workflow, notifications, audit — `features`, `content_reviews`, `content_scopes`, `notifications`, `audit_log`
- Policies: authored (`features`); `content_reviews`: insert when `submitted_by = actor.id`, read own, super admin all; `content_scopes`: read own, super admin all; `notifications`: read when `recipient_id = actor.id` or (`recipient_role = 'super_admin'` and super admin); insert `review_decision` only by super admin with `recipient_id` set, insert `submission_pending` only by content manager with `recipient_role = 'super_admin'`; `audit_log`: insert with `actor_id = actor.id`, read super admin only.
- Add these as named functions in `src/lib/authz/policies.ts` with tests (`canReadNotification`, `canInsertNotification`, `canInsertReview`, `canReadReview`, `canInsertAudit`, `canReadAudit`) before writing the repository.
- Repository: `src/lib/data/review.ts`.
- Files: `src/app/admin/audit-log/page.tsx`, `src/app/admin/features/**`, `src/app/admin/review-queue/page.tsx`, `src/app/admin/modules/[id]/quiz/page.tsx`, `src/app/app/library/{page,[id]/page}.tsx`, `src/lib/audit/log.ts`, `src/lib/content/review-actions.ts`, `src/lib/notifications/{get-notifications,mark-viewed}.ts`, `src/lib/tutor/retrieve-context.ts`.

#### Task A9: Learner progress — `quiz_attempts`, `certificates`
- Policies: `canReadLearnerRecord` (load the record owner's org ids with one query per page, not per row), `canInsertOwnRecord`.
- Repository: `src/lib/data/learner.ts`.
- Files: `src/app/app/{cases,certificates,modules,pathways}/**`, `src/app/app/page.tsx`, `src/lib/learner/{certificate-progress,competency-rows,get-recent-certificates,get-study-recommendation}.ts`, `src/lib/org/{get-org-progress,onboarding-progress}.ts`, `src/lib/quiz/certificates.ts`, `src/lib/trends/get-dashboard-trends.ts`.

#### Task A10: Organizations, billing, CMS, identity
- Org read/write rules beyond `canReadOrgScoped`/`canWriteOrgScoped` (add each as a named, tested policy function first): `organizations` and `org_catalog_selections` are readable by members; `organization_memberships` rows are readable by the member themselves or an org admin of that org; a membership **update** must pass `canManageOrgMembership(actor, "update", …)` for both the existing row and the new values; `onboarding_plans`/`onboarding_plan_items` are readable only by users with an `onboarding_assignments` row for that plan (not all members), writable by org admins of the plan's org; `onboarding_assignments` are readable by their own `user_id`.
- `src/lib/data/orgs.ts` — `organizations`, `organization_memberships`, `onboarding_plans`, `onboarding_plan_items`, `onboarding_assignments`, `org_catalog_selections`, plus wrappers for the 7 RPCs (`getPlatformOrgSummary`, `getOrgDashboardKpis`, `listOrgAtRiskLearners`, `listOrgWeakestModules`, `getOrgOnboardingCompletion`, `listOrgDailyActivityCounts`, `findProfileIdByEmail`) guarded by `canWriteOrgScoped` (org admin) or `isSuperAdmin`. The Stripe webhook's tier update is a system call like the tiling callback (`applyPaidTier(orgId, tierId)`, not actor-guarded). Files: `src/app/admin/organizations/**`, `src/app/api/billing/**`, `src/app/org/**`, `src/lib/learner/{get-learner-org,published-content}.ts`, `src/lib/org/{check-seat-limit,get-current-org,get-org-dashboard}.ts`, `src/lib/admin/get-platform-summary.ts`.
- `src/lib/data/cms.ts` — `pages`, `blog_posts`, `testimonials`, `associates`, `site_settings`, `enquiries` with `canReadPublicCms` / `canWriteCms` (enquiry insert open to anonymous). Files: `src/app/[slug]/page.tsx`, `src/app/admin/{associates,blog,enquiries,pages,testimonials}/**`, `src/app/blog/**`, `src/app/contact/**`, `src/app/team/page.tsx`, `src/lib/site-settings/*.ts`.
- `src/lib/data/identity.ts` — `profiles`, `impersonation_sessions` with `canReadProfile`, `canUpdateOwnProfile` (role changes super admin only — this replaces the `prevent_self_role_escalation` trigger), impersonation super admin + `actor_id = actor.id`. Files: `src/app/admin/learners/**`, `src/app/login/actions.ts` (profile read only), `src/app/reset-password/actions.ts`, `src/lib/auth/{account-actions,get-profile,impersonation,invite}.ts`, `src/lib/content/review-actions.ts`, `src/lib/notifications/*.ts`, `src/proxy.ts` (profile read only). **Leave `supabase.auth.*` calls in place** — they move in Task C4.

---

### Task A11: Lock the boundary with ESLint

**Files:** Modify `eslint.config.mjs`

- [ ] **Step 1: Add the rule**

Append to the exported config array:

```js
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/data/**", "src/lib/auth/**", "src/lib/supabase/**", "src/db/**", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/lib/supabase/*"], message: "Database access goes through src/lib/data/* repositories." },
          { group: ["@/db", "@/db/*"], message: "Database access goes through src/lib/data/* repositories." },
        ],
      }],
    },
  },
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: no errors. Any error means a query was missed in Tasks A3–A10 — move it into its repository, then re-run.

Run: `grep -rln "createClient\|createAdminClient" src | grep -vE "src/lib/(data|auth|supabase)/|src/proxy.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "Forbid database access outside repositories"
```

---

### Task A12: Move Supabase Storage to R2

`feature-images` is **private** today (signed URLs), so it goes to a new private R2 bucket, served with presigned GET URLs. The single legacy `slides` object goes to the existing public bucket, matching every other slide.

**Files:**
- Create: `src/lib/storage/private-objects.ts`, `src/lib/storage/private-objects.test.ts`, `scripts/storage/copy-supabase-storage-to-r2.mjs`
- Modify: `src/lib/r2.ts`, `src/app/admin/features/actions.ts`, `src/app/admin/features/feature-form.tsx`, `src/app/admin/features/[id]/details-form.tsx`, `src/app/admin/features/[id]/page.tsx`, `src/app/admin/features/[id]/edit/page.tsx`, `src/app/admin/features/page.tsx`, `src/app/app/library/[id]/page.tsx`, `src/lib/quiz/question-image-urls.ts`, `src/lib/slides/get-slide-view-url.ts`, `src/app/admin/slides/actions.ts`, `.env.example`

**Interfaces:**
- Produces: `featureImageKey(featureId: string, fileName: string): string` → `feature-images/<featureId>/<safeName>`; `createPrivateUploadUrl(key: string, contentType: string): Promise<string>`; `createPrivateReadUrl(key: string): Promise<string>` (10-minute expiry); `deletePrivateObject(key: string): Promise<void>`. `features.image_path` keeps holding a **key** (unchanged meaning), now in the private R2 bucket.

- [ ] **Step 1: Failing test for the key builder**

`src/lib/storage/private-objects.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { featureImageKey } from "./private-objects";

describe("featureImageKey", () => {
  it("scopes by feature id and sanitizes the file name", () => {
    expect(featureImageKey("f1", "My Cell (1).png")).toBe("feature-images/f1/My_Cell__1_.png");
  });
});
```

Run: `npx vitest run src/lib/storage/private-objects.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement**

In `src/lib/r2.ts` add:

```ts
export const R2_PRIVATE_BUCKET_NAME = process.env.R2_PRIVATE_BUCKET_NAME!;
```

`src/lib/storage/private-objects.ts`:

```ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_PRIVATE_BUCKET_NAME } from "@/lib/r2";

const TEN_MINUTES = 60 * 10;

export function featureImageKey(featureId: string, fileName: string): string {
  return `feature-images/${featureId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export function createPrivateUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    r2Client,
    new PutObjectCommand({ Bucket: R2_PRIVATE_BUCKET_NAME, Key: key, ContentType: contentType }),
    { expiresIn: TEN_MINUTES },
  );
}

export function createPrivateReadUrl(key: string): Promise<string> {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_PRIVATE_BUCKET_NAME, Key: key }), {
    expiresIn: TEN_MINUTES,
  });
}

/** Best-effort, like deleteMediaObject: an orphaned object isn't worth failing a request over. */
export async function deletePrivateObject(key: string): Promise<void> {
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_PRIVATE_BUCKET_NAME, Key: key }));
  } catch {
    // orphaned object
  }
}
```

Run the test → PASS.

- [ ] **Step 3: Switch the feature-image flow**

1. `createFeatureImageUploadTarget(featureId, fileName)` in `src/app/admin/features/actions.ts` now returns `{ path: featureImageKey(...), uploadUrl: await createPrivateUploadUrl(path, contentType) }` (add a `contentType` parameter and pass `file.type` from the forms).
2. In `feature-form.tsx` and `[id]/details-form.tsx`, replace `supabase.storage.from("feature-images").uploadToSignedUrl(target.path, target.token, file)` with:

   ```ts
   const put = await fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
   if (!put.ok) { setError("Image upload failed."); return; }
   ```
   and delete the `createClient` import from `@/lib/supabase/client`.
3. Every `supabase.storage.from("feature-images").createSignedUrl(path, …)` becomes `await createPrivateReadUrl(path)`; every `.remove([path])` becomes `await deletePrivateObject(path)`. Files: `features/actions.ts`, `features/[id]/page.tsx`, `features/[id]/edit/page.tsx`, `features/page.tsx`, `app/library/[id]/page.tsx`, `lib/quiz/question-image-urls.ts` (drop its `supabase` parameter and update its callers).
4. In `src/lib/slides/get-slide-view-url.ts` and `src/app/admin/slides/actions.ts`, delete the non-R2 legacy branches — after Step 5 every `slides.file_path` is an R2 URL.

- [ ] **Step 4: R2 bucket + CORS**

```bash
npx wrangler r2 bucket create hemoedge-private
npx wrangler r2 bucket cors set hemoedge-private --file scripts/storage/private-cors.json
```

`scripts/storage/private-cors.json`:

```json
{ "rules": [{ "allowed": { "origins": ["https://*.workers.dev", "http://localhost:3000", "http://localhost:8787"], "methods": ["PUT", "GET"], "headers": ["content-type"] }, "maxAgeSeconds": 3600 }] }
```

Add the production origin once the domain is on Cloudflare. Add `R2_PRIVATE_BUCKET_NAME=hemoedge-private` to `.env.example`, the Worker `vars`, and `.dev.vars`.

- [ ] **Step 5: Copy the existing objects**

`scripts/storage/copy-supabase-storage-to-r2.mjs`:

```js
#!/usr/bin/env node
// One-off: copies Supabase Storage objects into R2 and rewrites the legacy
// slides.file_path keys to public R2 URLs. Safe to re-run (PUT overwrites;
// the UPDATE only matches rows that still hold a bare key).
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
});

async function listFiles(bucket, prefix = "") {
  // Supabase lists one folder level at a time; folder entries have id === null.
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const files = [];
  for (const e of data) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) files.push(...(await listFiles(bucket, path)));
    else files.push(path);
  }
  return files;
}

async function copyBucket(bucket, targetBucket, keyFor) {
  const copied = [];
  for (const path of await listFiles(bucket)) {
    const { data: blob, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw error;
    const Key = keyFor(path);
    await r2.send(new PutObjectCommand({ Bucket: targetBucket, Key, Body: Buffer.from(await blob.arrayBuffer()), ContentType: blob.type }));
    copied.push({ path, Key });
    console.log(`${bucket}/${path} -> ${targetBucket}/${Key}`);
  }
  return copied;
}

await copyBucket("feature-images", env("R2_PRIVATE_BUCKET_NAME"), (p) => `feature-images/${p}`);
const slides = await copyBucket("slides", env("R2_BUCKET_NAME"), (p) => `slides/legacy/${p}`);

for (const { path, Key } of slides) {
  const { error } = await supabase.from("slides").update({ file_path: `${env("R2_PUBLIC_URL")}/${Key}` }).eq("file_path", path);
  if (error) throw error;
}
console.log("done");
```

Because keys change to `feature-images/<old path>`, also run once in the Supabase SQL editor:

```sql
update public.features set image_path = 'feature-images/' || image_path
where image_path is not null and image_path not like 'feature-images/%';
```

Run: `node --env-file=.env.local scripts/storage/copy-supabase-storage-to-r2.mjs`
Expected: 4 lines `… -> …` then `done`.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`. Manually: a feature with an image shows it on `/admin/features/<id>` and in an image-match quiz; upload a new image; the legacy slide opens in the viewer. `grep -rn "\.storage" src` → no output.

```bash
git add src scripts/storage .env.example
git commit -m "Serve feature images and legacy slides from R2 instead of Supabase Storage"
```

After a week with no issues, empty and delete both Supabase Storage buckets.

---

## Phase B — Dormant D1 + Better Auth infrastructure (merge to `main`)

### Task B1: D1 database, Drizzle schema, migrations, parity test

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema/index.ts`, `src/db/schema/<domain>.ts` (one per repository domain), `src/db/schema/auth.ts`, `drizzle/migrations/*`, `scripts/d1/pg-columns.json`, `src/db/schema-parity.test.ts`, `src/db/test-db.ts`
- Modify: `package.json`, `wrangler.jsonc`, `vitest.config.ts`

**Interfaces:**
- Produces: `import * as schema from "@/db/schema"` exposing one `sqliteTable` per Postgres table, same **table and column names** (snake_case); `createTestDb(): Promise<TestDb>`; `type Db` (Task B2).

- [ ] **Step 1: Install and create the database**

```bash
npm i drizzle-orm better-auth bcryptjs
npm i -D drizzle-kit @libsql/client @types/bcryptjs
npx wrangler d1 create hemoedge
```

Add the printed binding to `wrangler.jsonc`:

```jsonc
  "d1_databases": [
    { "binding": "DB", "database_name": "hemoedge", "database_id": "<printed id>", "migrations_dir": "drizzle/migrations" }
  ],
```

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle/migrations",
});
```

Scripts in `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate:local": "wrangler d1 migrations apply hemoedge --local",
"db:migrate:remote": "wrangler d1 migrations apply hemoedge --remote"
```

- [ ] **Step 2: Freeze the Postgres column list (the parity spec)**

Run in Supabase SQL and save the JSON array to `scripts/d1/pg-columns.json`:

```sql
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

- [ ] **Step 3: Write the parity test (fails until the schema is complete)**

`src/db/test-db.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

/** In-memory SQLite with the real D1 migrations applied — same SQL dialect
 * D1 runs, no Cloudflare runtime needed in unit tests. */
export async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle/migrations" });
  return Object.assign(db, { $client: client });
}
export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
```

`src/db/schema-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import pgColumns from "../../scripts/d1/pg-columns.json";
import { createTestDb } from "./test-db";

describe("D1 schema parity with Supabase Postgres", () => {
  it("has every Postgres table and column, with matching nullability", async () => {
    const db = await createTestDb();
    const missing: string[] = [];
    const tables = [...new Set(pgColumns.map((c) => c.table_name))];
    for (const table of tables) {
      const res = await db.$client.execute(`PRAGMA table_info("${table}")`);
      const cols = new Map(res.rows.map((r) => [String(r.name), Number(r.notnull) === 1 || Number(r.pk) === 1]));
      for (const c of pgColumns.filter((c) => c.table_name === table)) {
        if (!cols.has(c.column_name)) missing.push(`${table}.${c.column_name}`);
        else if (cols.get(c.column_name) !== (c.is_nullable === "NO")) missing.push(`${table}.${c.column_name} (nullability)`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

In `vitest.config.ts` add `"src/**/*.test.ts"` already covers it; ensure `resolveJsonModule` is on in `tsconfig.json` (it is by default in Next's tsconfig; add if not).

Run: `npx vitest run src/db/schema-parity.test.ts` → FAIL (no migrations yet).

- [ ] **Step 4: Write the schema**

Get a faithful starting point by introspecting Postgres (read-only):

```bash
DATABASE_URL="<Supabase session-pooler connection string>" npx drizzle-kit pull --dialect postgresql --out /tmp/pg-introspect
```

Port each table from `/tmp/pg-introspect/schema.ts` to `sqlite-core` in the matching `src/db/schema/<domain>.ts`, applying the type mapping from Global Constraints. Shared column helpers in `src/db/schema/columns.ts`:

```ts
import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/sqlite-core";

export const uuidPk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
export const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
export const createdAt = () => text("created_at").notNull().default(nowIso);
```

Worked example — `src/db/schema/taxonomy.ts` (exact live columns as of 2026-09-25):

```ts
import { integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { createdAt, uuidPk } from "./columns";

export const tags = sqliteTable("tags", {
  id: uuidPk(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  created_at: createdAt(),
}, (t) => [uniqueIndex("tags_slug_key").on(t.slug)]);

export const cellTypes = sqliteTable("cell_types", {
  id: uuidPk(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  slug: text("slug").notNull(),
  lineage: text("lineage").notNull(),
  created_at: createdAt(),
  description: text("description"),
  is_wbc_diff_countable: integer("is_wbc_diff_countable", { mode: "boolean" }).notNull().default(false),
}, (t) => [uniqueIndex("cell_types_slug_key").on(t.slug)]);

export const slideCategories = sqliteTable("slide_categories", {
  id: uuidPk(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parent_id: text("parent_id").references((): AnySQLiteColumn => slideCategories.id, { onDelete: "set null" }),
  description: text("description"),
  created_at: createdAt(),
}, (t) => [uniqueIndex("slide_categories_slug_key").on(t.slug)]);
```

Check each unique index / FK action against `/tmp/pg-introspect/schema.ts` — the names and `onDelete` behavior above must match what introspection shows; fix them if they differ.

Enum example (`profiles.role`):

```ts
export const APP_ROLES = ["super_admin", "content_manager", "org_admin", "member"] as const;
role: text("role", { enum: APP_ROLES }).notNull().default("member"),
```

plus `check("profiles_role_check", sql\`${t.role} in ('super_admin','content_manager','org_admin','member')\`)` in the table's extra config.

`profiles.id` references `user.id` (Better Auth) with `onDelete: "cascade"`, replacing the FK to `auth.users`.

- [ ] **Step 5: Better Auth tables**

Create `src/lib/auth/better-auth.ts` (Task B3, Step 3) first, then run:

```bash
npx auth@latest generate --output src/db/schema/auth.ts
```

Re-export everything from `src/db/schema/index.ts`:

```ts
export * from "./auth";
export * from "./taxonomy";
export * from "./content";
export * from "./cases";
export * from "./slides";
export * from "./exercises";
export * from "./review";
export * from "./learner";
export * from "./orgs";
export * from "./cms";
export * from "./identity";
```

- [ ] **Step 6: Generate migrations + the FTS5 migration**

```bash
npm run db:generate
npx drizzle-kit generate --custom --name fulltext_search
```

Fill the generated empty custom migration with FTS5 tables replacing the three Postgres `websearch` queries:

```sql
CREATE VIRTUAL TABLE features_fts USING fts5(definition, content='features', content_rowid='rowid');
CREATE VIRTUAL TABLE modules_fts USING fts5(description, content='modules', content_rowid='rowid');
CREATE VIRTUAL TABLE cases_fts USING fts5(description, content='cases', content_rowid='rowid');
--> statement-breakpoint
CREATE TRIGGER features_ai AFTER INSERT ON features BEGIN INSERT INTO features_fts(rowid, definition) VALUES (new.rowid, new.definition); END;
CREATE TRIGGER features_ad AFTER DELETE ON features BEGIN INSERT INTO features_fts(features_fts, rowid, definition) VALUES ('delete', old.rowid, old.definition); END;
CREATE TRIGGER features_au AFTER UPDATE ON features BEGIN INSERT INTO features_fts(features_fts, rowid, definition) VALUES ('delete', old.rowid, old.definition); INSERT INTO features_fts(rowid, definition) VALUES (new.rowid, new.definition); END;
CREATE TRIGGER modules_ai AFTER INSERT ON modules BEGIN INSERT INTO modules_fts(rowid, description) VALUES (new.rowid, new.description); END;
CREATE TRIGGER modules_ad AFTER DELETE ON modules BEGIN INSERT INTO modules_fts(modules_fts, rowid, description) VALUES ('delete', old.rowid, old.description); END;
CREATE TRIGGER modules_au AFTER UPDATE ON modules BEGIN INSERT INTO modules_fts(modules_fts, rowid, description) VALUES ('delete', old.rowid, old.description); INSERT INTO modules_fts(rowid, description) VALUES (new.rowid, new.description); END;
CREATE TRIGGER cases_ai AFTER INSERT ON cases BEGIN INSERT INTO cases_fts(rowid, description) VALUES (new.rowid, new.description); END;
CREATE TRIGGER cases_ad AFTER DELETE ON cases BEGIN INSERT INTO cases_fts(cases_fts, rowid, description) VALUES ('delete', old.rowid, old.description); END;
CREATE TRIGGER cases_au AFTER UPDATE ON cases BEGIN INSERT INTO cases_fts(cases_fts, rowid, description) VALUES ('delete', old.rowid, old.description); INSERT INTO cases_fts(rowid, description) VALUES (new.rowid, new.description); END;
```

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run src/db/schema-parity.test.ts && npm run db:migrate:local && npx tsc --noEmit`
Expected: parity test passes (empty `missing` list); local D1 applies all migrations.

```bash
git add drizzle.config.ts drizzle src/db scripts/d1/pg-columns.json package.json package-lock.json wrangler.jsonc vitest.config.ts
git commit -m "Add D1 schema mirroring the Supabase database"
```

---

### Task B2: Database access in the Worker

**Files:** Create `src/db/index.ts`

**Interfaces:**
- Produces: `getDb(): Db` and `type Db = BaseSQLiteDatabase<"async", unknown, typeof schema>` — both the D1 and the libsql test database satisfy it, so repositories are testable with `createTestDb()`.
- Produces: `withTestDb(db: Db)` / `resetDbOverride()` for tests.

- [ ] **Step 1: Implement**

```ts
import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = BaseSQLiteDatabase<"async", any, typeof schema>;

let override: Db | null = null;

/** Tests swap in an in-memory libsql database (createTestDb). */
export function withTestDb(db: Db) { override = db; }
export function resetDbOverride() { override = null; }

export function getDb(): Db {
  return override ?? (drizzle(env.DB, { schema }) as unknown as Db);
}
```

In `vitest.config.ts`, alias the Workers-only module so unit tests can import `@/db`:

```ts
resolve: { alias: { "cloudflare:workers": new URL("./src/db/cloudflare-workers.stub.ts", import.meta.url).pathname } },
```

`src/db/cloudflare-workers.stub.ts`:

```ts
export const env = {} as Record<string, never>;
```

Run `npm run cf-typegen` so `env.DB` is typed as `D1Database`.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit && npm run test && npm run build:cf`

```bash
git add src/db/index.ts src/db/cloudflare-workers.stub.ts vitest.config.ts cloudflare-env.d.ts
git commit -m "Add D1 database accessor"
```

---

### Task B3: Better Auth (dormant)

**Files:**
- Create: `src/lib/auth/better-auth.ts`, `src/lib/auth/password.ts`, `src/lib/auth/password.test.ts`, `src/lib/auth/new-user-profile.ts`, `src/lib/auth/new-user-profile.test.ts`

**Interfaces:**
- Produces: `getAuth()` (Better Auth instance); `verifyPassword({ hash, password }): Promise<boolean>`; `hashPassword(password): Promise<string>`; `buildNewUserRecords(input: { userId: string; email: string; fullName: string | null; signupRole: string | null; orgName: string | null }): { profile: {...}; organization?: {...}; membership?: {...} }`.

- [ ] **Step 1: Failing tests**

`src/lib/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password";

describe("password compatibility", () => {
  it("verifies an imported Supabase bcrypt hash", async () => {
    const hash = await bcrypt.hash("correct horse", 10); // same $2a$ format Supabase stores
    expect(await verifyPassword({ hash, password: "correct horse" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong" })).toBe(false);
  });
  it("hashes new passwords with Better Auth's default and verifies them", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(hash.startsWith("$2")).toBe(false);
    expect(await verifyPassword({ hash, password: "s3cret-pass" })).toBe(true);
  });
});
```

`src/lib/auth/new-user-profile.test.ts` (ports `handle_new_user()` exactly):

```ts
import { describe, it, expect } from "vitest";
import { buildNewUserRecords } from "./new-user-profile";

const base = { userId: "12345678-aaaa-bbbb-cccc-000000000000", email: "a@b.com", fullName: "Ann", orgName: null };

describe("buildNewUserRecords", () => {
  it("defaults to member", () => {
    expect(buildNewUserRecords({ ...base, signupRole: null }).profile.role).toBe("member");
  });
  it("honours self-serve content_manager / org_admin, ignores anything else", () => {
    expect(buildNewUserRecords({ ...base, signupRole: "content_manager" }).profile.role).toBe("content_manager");
    expect(buildNewUserRecords({ ...base, signupRole: "super_admin" }).profile.role).toBe("member");
  });
  it("makes the platform owner email a super admin", () => {
    expect(buildNewUserRecords({ ...base, email: "consultant@optymumss.com", signupRole: null }).profile.role).toBe("super_admin");
  });
  it("creates an org and owner membership for org_admin signups", () => {
    const r = buildNewUserRecords({ ...base, signupRole: "org_admin", orgName: "  St. Mary's Lab " });
    expect(r.organization).toMatchObject({ name: "St. Mary's Lab", slug: "st-mary-s-lab-12345678" });
    expect(r.membership).toMatchObject({ user_id: base.userId, org_role: "owner", org_id: r.organization!.id });
  });
  it("falls back to 'My Organization' when no org name is given", () => {
    const r = buildNewUserRecords({ ...base, signupRole: "org_admin" });
    expect(r.organization).toMatchObject({ name: "My Organization", slug: "organization-12345678" });
  });
});
```

Run both → FAIL.

- [ ] **Step 2: Implement helpers**

`src/lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";
import { hashPassword as scryptHash, verifyPassword as scryptVerify } from "better-auth/crypto";

/** Users migrated from Supabase carry bcrypt hashes ($2a$/$2b$); everyone
 * who sets a password after the migration gets Better Auth's scrypt. */
export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  if (hash.startsWith("$2")) return bcrypt.compare(password, hash);
  return scryptVerify({ hash, password });
}

export const hashPassword = (password: string) => scryptHash(password);
```

`src/lib/auth/new-user-profile.ts`:

```ts
import type { AppRole } from "./roles";

const PLATFORM_OWNER_EMAIL = "consultant@optymumss.com";

/** TypeScript port of the Postgres handle_new_user() trigger. */
export function buildNewUserRecords(input: {
  userId: string;
  email: string;
  fullName: string | null;
  signupRole: string | null;
  orgName: string | null;
}) {
  const role: AppRole =
    input.email === PLATFORM_OWNER_EMAIL
      ? "super_admin"
      : input.signupRole === "content_manager" || input.signupRole === "org_admin"
        ? input.signupRole
        : "member";

  const profile = { id: input.userId, email: input.email, full_name: input.fullName, role };
  if (role !== "org_admin") return { profile };

  const orgName = input.orgName?.trim() || null;
  const slugBase = (orgName ?? "organization").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const organization = {
    id: crypto.randomUUID(),
    name: orgName ?? "My Organization",
    slug: `${slugBase}-${input.userId.slice(0, 8)}`,
  };
  const membership = { org_id: organization.id, user_id: input.userId, org_role: "owner" as const };
  return { profile, organization, membership };
}
```

Run both tests → PASS.

- [ ] **Step 3: Better Auth instance**

`src/lib/auth/better-auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import { accountInviteEmail, passwordResetEmail, verifyEmailEmail } from "@/lib/email/templates";
import { hashPassword, verifyPassword } from "./password";

function createAuth() {
  const db = getDb();
  return betterAuth({
    baseURL: process.env.APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    advanced: { database: { generateId: "uuid" } },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Invited users have no credential account yet: send the invite
        // template instead of "reset your password".
        const accounts = await db.select().from(schema.account).where(eq(schema.account.userId, user.id));
        const invited = !accounts.some((a) => a.providerId === "credential");
        const { subject, html } = invited ? accountInviteEmail("HemoEdge", url) : passwordResetEmail(url);
        await sendEmail(user.email, subject, html);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const { subject, html } = verifyEmailEmail(url);
        await sendEmail(user.email, subject, html);
      },
    },
    user: {
      changeEmail: { enabled: true },
      deleteUser: { enabled: true },
    },
    databaseHooks: {
      user: {
        update: {
          // Port of handle_user_email_change(): keep profiles.email in sync.
          after: async (user) => {
            await db.update(schema.profiles).set({ email: user.email }).where(eq(schema.profiles.id, user.id));
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

let auth: ReturnType<typeof createAuth> | null = null;
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
```

Add `passwordResetEmail(url)` and `verifyEmailEmail(url)` to `src/lib/email/templates.ts`, styled like the existing `accountInviteEmail` (same wrapper function, subject lines "Reset your HemoEdge password" and "Confirm your HemoEdge email"). Add `BETTER_AUTH_SECRET=` to `.env.example` (generate with `openssl rand -base64 32`).

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm run test && npm run build:cf`

```bash
git add src/lib/auth src/lib/email/templates.ts .env.example package.json package-lock.json
git commit -m "Add dormant Better Auth configuration with Supabase password compatibility"
```

---

### Task B4: Data export/import scripts + staging rehearsal

**Files:** Create `scripts/d1/export-supabase.mjs`, `scripts/d1/build-import-sql.mjs`

**Interfaces:**
- Produces: `node scripts/d1/export-supabase.mjs > tmp/supabase-export.json` and `node scripts/d1/build-import-sql.mjs tmp/supabase-export.json > tmp/import.sql`, applied with `wrangler d1 execute hemoedge --file tmp/import.sql`. `tmp/` is gitignored (add it).

- [ ] **Step 1: Export**

`scripts/d1/export-supabase.mjs` (read-only; uses a direct Postgres connection because `auth.users.encrypted_password` isn't exposed over the REST API):

```js
#!/usr/bin/env node
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const tables = (await client.query(
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
)).rows.map((r) => r.table_name);

const out = { public: {}, users: [] };
for (const t of tables) out.public[t] = (await client.query(`select * from public."${t}"`)).rows;

out.users = (await client.query(
  `select id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
          raw_user_meta_data->>'full_name' as full_name
   from auth.users order by created_at`,
)).rows;

await client.end();
process.stdout.write(JSON.stringify(out, (_k, v) => (v instanceof Date ? v.toISOString() : v)));
```

Install `pg` as a dev dependency: `npm i -D pg`.

- [ ] **Step 2: Build the import SQL**

`scripts/d1/build-import-sql.mjs`:

```js
#!/usr/bin/env node
// Turns the export into one SQL file for `wrangler d1 execute`. Parents
// before children (FK order); JSON/array columns stringified; booleans 0/1.
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return `'${JSON.stringify(v).replaceAll("'", "''")}'`;
  return `'${String(v).replaceAll("'", "''")}'`;
};
const insert = (table, row) =>
  `INSERT INTO "${table}" (${Object.keys(row).map((k) => `"${k}"`).join(", ")}) VALUES (${Object.values(row).map(q).join(", ")});`;

const lines = ["PRAGMA defer_foreign_keys = ON;"];

for (const u of data.users) {
  lines.push(insert("user", {
    id: u.id, email: u.email, name: u.full_name ?? "", emailVerified: u.email_confirmed_at ? 1 : 0,
    createdAt: u.created_at, updatedAt: u.updated_at ?? u.created_at,
  }));
  if (u.encrypted_password) {
    lines.push(insert("account", {
      id: crypto.randomUUID(), userId: u.id, accountId: u.id, providerId: "credential",
      password: u.encrypted_password, createdAt: u.created_at, updatedAt: u.updated_at ?? u.created_at,
    }));
  }
}

// FK-safe order; every public table must appear exactly once.
const ORDER = [
  "profiles", "tiers", "organizations", "organization_memberships",
  "tags", "cell_types", "slide_categories",
  "modules", "lessons", "module_tags", "module_prerequisites",
  "curricula", "curriculum_modules",
  "cases", "case_modules", "case_tags",
  "slides", "slide_annotations", "case_slides", "tiling_jobs",
  "features", "case_features",
  "quiz_questions", "quiz_attempts", "certificates", "case_report_submissions",
  "wbc_diff_exercises", "wbc_diff_hotspots", "wbc_diff_attempts",
  "cell_id_exercises", "cell_id_hotspots", "cell_id_attempts",
  "slide_views", "content_reviews", "content_scopes", "notifications", "audit_log",
  "onboarding_plans", "onboarding_plan_items", "onboarding_assignments", "org_catalog_selections",
  "impersonation_sessions", "pages", "blog_posts", "testimonials", "associates", "site_settings", "enquiries",
];
const missing = Object.keys(data.public).filter((t) => !ORDER.includes(t));
if (missing.length) throw new Error(`Add to ORDER: ${missing.join(", ")}`);

for (const table of ORDER) for (const row of data.public[table] ?? []) lines.push(insert(table, row));
process.stdout.write(lines.join("\n") + "\n");
```

(Check the Better Auth `account`/`user` column names against `src/db/schema/auth.ts` — they're camelCase in Better Auth's default schema; fix the keys above if the generated schema differs.)

- [ ] **Step 3: Rehearse locally**

```bash
mkdir -p tmp && echo "tmp/" >> .gitignore
SUPABASE_DB_URL="<session-pooler URL>" node scripts/d1/export-supabase.mjs > tmp/supabase-export.json
node scripts/d1/build-import-sql.mjs tmp/supabase-export.json > tmp/import.sql
npm run db:migrate:local && npx wrangler d1 execute hemoedge --local --file tmp/import.sql
npx wrangler d1 execute hemoedge --local --command "select (select count(*) from user) u, (select count(*) from profiles) p, (select count(*) from modules) m"
```

Expected: `u = 7`, `p = 7`, `m = 8` (matching the live counts at export time). Also run `INSERT INTO features_fts(features_fts) VALUES('rebuild');` (and for `modules_fts`, `cases_fts`) — the import SQL bypasses nothing, but rebuilding guarantees the FTS index matches.

- [ ] **Step 4: Commit**

```bash
git add scripts/d1 .gitignore package.json package-lock.json
git commit -m "Add Supabase export and D1 import scripts"
```

---

## Phase C — Switch to D1 + Better Auth (branch `d1-cutover`, one PR)

Create the branch from `main` only after Phases A and B are merged. Keep it short-lived (target ≤ 1 week); rebase on `main` daily. Freeze schema changes on `main` for the duration (announce it).

### Task C1: Repository test harness

**Files:** Create `src/lib/data/test-helpers.ts`

- [ ] **Step 1: Implement**

```ts
import { afterEach, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "@/db/test-db";
import { withTestDb, resetDbOverride, type Db } from "@/db";
import * as schema from "@/db/schema";
import type { Actor } from "@/lib/authz/actor";

export function useTestDb(): { db: () => TestDb } {
  let db: TestDb;
  beforeEach(async () => { db = await createTestDb(); withTestDb(db as unknown as Db); });
  afterEach(() => resetDbOverride());
  return { db: () => db };
}

export function makeActor(over: Partial<Actor> = {}): Actor {
  return { id: crypto.randomUUID(), role: "member", orgAdminOf: new Set(), memberOf: new Set(), contentScopes: new Set(), ...over };
}

/** Inserts a Better Auth user + profile so FKs to profiles resolve. */
export async function seedUser(db: TestDb, actor: Actor) {
  const now = new Date().toISOString();
  await db.insert(schema.user).values({ id: actor.id, email: `${actor.id}@t.test`, name: "T", emailVerified: true, createdAt: new Date(now), updatedAt: new Date(now) });
  await db.insert(schema.profiles).values({ id: actor.id, email: `${actor.id}@t.test`, full_name: "T", role: actor.role });
}
```

(If the generated Better Auth schema stores dates as `integer({ mode: "timestamp" })`, `new Date(...)` is correct; if it uses text, pass `now`.)

- [ ] **Step 2: Commit** — `git commit -m "Add repository test harness on in-memory SQLite"`

### Task C2: Port the taxonomy repository (worked example)

**Files:** Modify `src/lib/data/taxonomy.ts`, `src/lib/data/identity.ts` (`loadActorGrants`); Create `src/lib/data/taxonomy.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { useTestDb, makeActor, seedUser } from "./test-helpers";
import { ForbiddenError } from "@/lib/authz/errors";
import { createSlideCategory, deleteSlideCategory, listSlideCategories, updateSlideCategory } from "./taxonomy";

describe("slide categories on D1", () => {
  const { db } = useTestDb();

  it("content managers create, rename and delete; signed-in users list", async () => {
    const cm = makeActor({ role: "content_manager" });
    await seedUser(db(), cm);
    await createSlideCategory(cm, { name: "Acute Leukemia", parentId: null, description: null });
    let rows = await listSlideCategories(makeActor());
    expect(rows).toMatchObject([{ name: "Acute Leukemia", slug: "acute-leukemia", parent_id: null }]);

    await updateSlideCategory(cm, rows[0].id, { name: "AML", parentId: null, description: "x" });
    rows = await listSlideCategories(cm);
    expect(rows[0]).toMatchObject({ name: "AML", slug: "aml", description: "x" });

    await deleteSlideCategory(cm, rows[0].id);
    expect(await listSlideCategories(cm)).toEqual([]);
  });

  it("members cannot write; anonymous cannot read", async () => {
    await expect(createSlideCategory(makeActor(), { name: "x", parentId: null, description: null })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listSlideCategories(null)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
```

Run → FAIL (still calls supabase).

- [ ] **Step 2: Port**

Replace the bodies (signatures unchanged):

```ts
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { slideCategories } from "@/db/schema";
// ...
export async function listSlideCategories(actor: Actor | null): Promise<SlideCategory[]> {
  assertAllowed(canReadTaxonomy(actor));
  return getDb()
    .select({ id: slideCategories.id, name: slideCategories.name, slug: slideCategories.slug, description: slideCategories.description, parent_id: slideCategories.parent_id })
    .from(slideCategories)
    .orderBy(asc(slideCategories.name));
}

export async function createSlideCategory(actor: Actor | null, input: SlideCategoryInput): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  await getDb().insert(slideCategories).values({ name: input.name, slug: slugify(input.name), parent_id: input.parentId, description: input.description });
}

export async function updateSlideCategory(actor: Actor | null, id: string, input: SlideCategoryInput): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  await getDb().update(slideCategories)
    .set({ name: input.name, slug: slugify(input.name), parent_id: input.parentId, description: input.description })
    .where(eq(slideCategories.id, id));
}

export async function deleteSlideCategory(actor: Actor | null, id: string): Promise<void> {
  assertAllowed(canWriteTaxonomy(actor, "slide_categories"));
  await getDb().delete(slideCategories).where(eq(slideCategories.id, id));
}
```

Port `loadActorGrants` the same way (two `select`s on `organization_memberships` and `content_scopes`).

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run src/lib/data/taxonomy.test.ts && npx tsc --noEmit`

```bash
git commit -am "Port taxonomy repository to D1"
```

### Task C3: Port every other repository

For each of `content`, `cases`, `slides`, `exercises`, `review`, `learner`, `orgs`, `cms`, `identity` (one commit each, in that order), do all of the following:

- [ ] **Step 1: Tests first.** Create `src/lib/data/<domain>.test.ts` using `useTestDb`/`makeActor`/`seedUser`. For **every** function: one allowed-actor happy path, and for every policy branch in the rows of `supabase/rls-snapshot.json` for that domain's tables, one test proving the D1 version allows/denies the same actors. Lists must be tested for **filtering** (e.g. `listModules` for a member returns published rows only; for the author also returns their drafts; for super admin returns all). Run → FAIL.
- [ ] **Step 2: Port bodies to Drizzle.** Reads that relied on RLS filtering now filter explicitly. Use these exact SQL equivalents:
  - authored list for actor `a`: `isSuperAdmin(a) ? undefined : a ? or(eq(t.status, "published"), eq(t.created_by, a.id)) : eq(t.status, "published")`
  - child list: join the parent and apply the same condition to the parent's columns
  - learner-record list for an org admin: `inArray(t.user_id, db.select({ id: organizationMemberships.user_id }).from(organizationMemberships).where(inArray(organizationMemberships.org_id, [...a.orgAdminOf])))` OR `eq(t.user_id, a.id)`
  - PostgREST embedded selects (`select("..., profiles(...)")`) become explicit `leftJoin`s returning the same object shape.
  - Multi-row writes use `db.batch([...])` (never `db.transaction`).
- [ ] **Step 3: RPCs (orgs domain).** Rewrite each of the 7 SQL functions as TypeScript in `src/lib/data/orgs.ts`, keeping the RPC wrapper names from Task A10. Source SQL: `supabase/migrations/20260918090000_org_dashboard_aggregates.sql`, `20260919090000_org_daily_activity_counts.sql`, `20260919100000_platform_org_summary.sql`, and the `find_profile_id_by_email` migration. Tests seed a small org (1 admin, 3 members, attempts on 2 modules) and assert the exact numbers the SQL version returns for the same seed — run the same seed once against Supabase (`execute_sql` on a branch database) to get the expected values.
- [ ] **Step 4: Full-text search.** Port `src/lib/tutor/retrieve-context.ts` to FTS5:

  ```ts
  const ftsQuery = query.replace(/["*^:()]/g, " ").trim().split(/\s+/).filter(Boolean).map((w) => `"${w}"`).join(" OR ");
  const features = await getDb().all<{ title: string; definition: string }>(sql`
    select f.title, f.definition from features_fts
    join features f on f.rowid = features_fts.rowid
    where features_fts match ${ftsQuery} and f.status = 'published'
    order by rank limit ${limit}`);
  ```
  (same for `modules_fts` and `cases_fts`). Test: seed a published and a draft feature, query a word in both, expect only the published one.
- [ ] **Step 5: Verify and commit.** `npx vitest run src/lib/data && npx tsc --noEmit`, then `git commit -am "Port <domain> repository to D1"`.

### Task C4: Switch authentication to Better Auth

**Files:**
- Create: `src/app/api/auth/[...all]/route.ts`
- Modify: `src/lib/supabase/proxy.ts` → replace with `src/lib/auth/session.ts`, `src/proxy.ts`, `src/lib/auth/get-profile.ts`, `src/lib/auth/impersonation.ts`, `src/lib/auth/invite.ts`, `src/lib/auth/account-actions.ts`, `src/app/login/actions.ts`, `src/app/forgot-password/**`, `src/app/reset-password/**`, `src/app/auth/confirm/page.tsx`
- Delete: `src/app/auth/confirm/hash-fragment-fallback.tsx`

- [ ] **Step 1: Route handler**

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/better-auth";

export const { GET, POST } = toNextJsHandler((req: Request) => getAuth().handler(req));
```

- [ ] **Step 2: Session helper + proxy**

`src/lib/auth/session.ts`:

```ts
import { getAuth } from "./better-auth";

export async function getSessionUser(headers: Headers): Promise<{ id: string; email: string } | null> {
  const session = await getAuth().api.getSession({ headers });
  return session ? { id: session.user.id, email: session.user.email } : null;
}
```

In `src/proxy.ts`: replace `updateSession(request)` with `const user = await getSessionUser(request.headers)`; replace the `profiles` query with `getProfileForProxy(user.id)` from `src/lib/data/identity.ts` (a system read: returns `{ role, full_name, email }`); return `NextResponse.next({ request: { headers: requestHeaders } })` (Better Auth refreshes its own cookies through the `/api/auth` routes and `nextCookies`, so the cookie-copy loop is removed). Add `api/auth` to the matcher exclusions: `"/((?!_next/static|_next/image|favicon.ico|api/auth).*)"`.

- [ ] **Step 3: Flows** — replace each Supabase call:

| Current | Better Auth |
|---|---|
| `auth.signInWithPassword({ email, password })` | `getAuth().api.signInEmail({ body: { email, password }, headers: await headers() })` |
| `auth.signUp({ email, password, options: { data } })` | `const { user } = await getAuth().api.signUpEmail({ body: { email, password, name: fullName } })`, then `createProfileForNewUser(buildNewUserRecords({ userId: user.id, email, fullName, signupRole, orgName }))` (new repository function in `identity.ts`, one `db.batch` inserting profile [+ org + membership]) |
| `auth.signOut()` | `getAuth().api.signOut({ headers: await headers() })` |
| `auth.resetPasswordForEmail(email, { redirectTo })` | `getAuth().api.requestPasswordReset({ body: { email, redirectTo: \`${origin}/reset-password\` } })` |
| reset page: `auth.updateUser({ password })` after `verifyOtp` | page reads `token` from `searchParams`; action calls `getAuth().api.resetPassword({ body: { newPassword, token } })` |
| `auth.updateUser({ email })` | `getAuth().api.changeEmail({ body: { newEmail, callbackURL: "/app/settings" }, headers })` |
| `auth.updateUser({ password })` (settings) | `getAuth().api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers })` — **the settings form gains a "current password" field** (Better Auth requires it; Supabase didn't) |
| `auth.admin.deleteUser(id)` | `getAuth().api.deleteUser({ body: {}, headers })` for self-delete; profile rows cascade from `user` |
| `auth.admin.generateLink({ type: "invite" })` | `identity.createInvitedUser({ email, fullName, role })` inserts a `user` row (emailVerified = true, no password) + its profile in one `db.batch`, then `getAuth().api.requestPasswordReset({ body: { email, redirectTo: \`${origin}/reset-password\` } })`. Because the user has no credential account yet, `sendResetPassword` sends the invite template; setting a password creates the account |
| `auth.verifyOtp` in `/auth/confirm` | verification links now go to `/api/auth/verify-email?token=…&callbackURL=…`; `/auth/confirm` becomes a redirect to `/login` for old links |
| `auth.getUser()` (all remaining call sites) | `getSessionUser(await headers())` |

- [ ] **Step 4: Tests for the new flows**

Add `src/lib/data/identity.test.ts` cases: `createProfileForNewUser` for member/org_admin inserts the right rows; `createInvitedUser` creates `user` + profile with the requested role and no `account` row. Add an e2e test `e2e/auth.spec.ts`: sign up → (read the verification URL from a test email sink: set `EMAIL_TRANSPORT=log` so `sendEmail` logs to stdout in dev) → verify → login → logout; reset password end to end.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build:cf && npm run preview:cf` then log in locally as a user imported by Task B4's rehearsal (using their real password — proves bcrypt compatibility).

```bash
git commit -am "Switch authentication from Supabase Auth to Better Auth"
```

### Task C5: Remove Supabase

- [ ] **Step 1:** `git rm -r src/lib/supabase src/app/auth/confirm/hash-fragment-fallback.tsx && npm uninstall @supabase/ssr @supabase/supabase-js`
- [ ] **Step 2:** Remove `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from `.env.example`, `ci.yml` `env`, Workers Builds build variables, and Worker secrets (`wrangler secret delete SUPABASE_SERVICE_ROLE_KEY`). Add `BETTER_AUTH_SECRET` as a Worker secret.
- [ ] **Step 3:** Update the ESLint rule from Task A11 to drop the `@/lib/supabase/*` pattern (it no longer exists).
- [ ] **Step 4:** `grep -rni supabase src` → only historical comments; rewrite those that describe current behavior.
- [ ] **Step 5:** Full verification: `npx tsc --noEmit && npm run lint && npm run test && npm run build:cf && npm run test:e2e` (update `playwright.config.ts` `webServer.command` to `npm run preview:cf` and `baseURL` to `http://localhost:8787`, with a seeded local D1).
- [ ] **Step 6:** Commit `Remove Supabase`, push, open the PR from `d1-cutover`. **Do not merge until Task C6 is scheduled** — merging deploys to production.

### Task C6: Cutover (maintenance window, ~30 minutes)

- [ ] **Step 1: Staging rehearsal (T-2 days).** Create `hemoedge-staging` D1, deploy the PR's preview with it bound (`wrangler.jsonc` `env.staging`), run Task B4's export/import against it, and test with 2 real accounts (password login with their existing password, reset, invite, one of each role's main pages).
- [ ] **Step 2: Freeze (T-0).** Put a maintenance banner up (site setting) and block writes: set Supabase to read-only by revoking insert/update/delete from `authenticated` and `anon` on `public` tables (`execute_sql`), announced to the 7 users by email the day before.
- [ ] **Step 3: Final copy.** Export → build SQL → `npm run db:migrate:remote && npx wrangler d1 execute hemoedge --remote --file tmp/import.sql` → FTS rebuild → verify counts equal the export.
- [ ] **Step 4: Deploy.** Merge the PR (Workers Builds deploys; its deploy command becomes `npm run db:migrate:remote && npm run deploy:cf:ci` so future schema changes migrate before deploy).
- [ ] **Step 5: Smoke test** as super admin, content manager, org admin, member: login with existing password, dashboard, one write each, image-match quiz image, tutor answer, Stripe test webhook, tiling callback.
- [ ] **Step 6: Rollback plan.** If Step 5 fails: `npx wrangler rollback` to the previous Worker version (still Supabase-backed), re-grant write privileges on Supabase. Any writes made on D1 in between are lost — keep the window short and the site in maintenance until Step 5 passes.
- [ ] **Step 7: Decommission (T+30 days).** Take a final `pg_dump` of Supabase to R2 (`hemoedge-private/backups/`), then pause and delete the Supabase project. Remove `supabase/` from the repo (migrations and `rls-snapshot.json` are superseded by `drizzle/` and the `authz` tests).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| An RLS rule is missed and data leaks | Frozen `rls-snapshot.json` is the checklist; every policy row maps to an `authz` test (A1) and a D1 repository test (C3); RLS stays on under Phase A as a safety net while callers move |
| Better Auth ≠ Supabase Auth behavior (e.g. change-password now needs the current password) | Listed explicitly in Task C4; e2e auth tests; staging rehearsal with real accounts |
| D1 limits: 10 GB per database, no interactive transactions, single-region primary | Data is 15 MB; `db.batch` for atomic multi-writes; enable D1 read replication later if latency needs it |
| Long-running branch conflicts with daily feature work | Phase A merges incrementally; Phase C touches only `src/lib/data/*` and auth files; schema freeze on `main` during Phase C only |
| Password hashes incompatible | bcrypt verify path is unit-tested (B3) and proven with a real imported user (C4, C6 Step 1) |
| Aggregate RPCs return different numbers | Same-seed comparison against the SQL originals (C3 Step 3) |

## Out of scope

- Vector/embedding search for the tutor (FTS5 matches today's lexical behavior).
- OAuth/MFA (not used today; Better Auth plugins can add them later).
- Supabase Edge Functions (none exist).
