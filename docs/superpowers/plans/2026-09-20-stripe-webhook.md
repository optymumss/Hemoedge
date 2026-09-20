# Stripe Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Stripe webhook endpoint that applies `organizations.tier_id` when a checkout session completes, closing the gap where a customer can pay via Stripe Checkout and their org never actually upgrades.

**Architecture:** A new route `src/app/api/billing/webhook/route.ts`, modeled directly on the existing `src/app/api/tiling/callback/route.ts` pattern (verified external caller, no user session, writes past RLS via the service-role `createAdminClient()`). Signature verification uses Stripe's own SDK (`stripe.webhooks.constructEvent`). A pure function extracts and validates the checkout session's `org_id`/`tier_id` metadata. A bundled migration documents two columns and two more that already exist live but were never captured in a local migration file.

**Tech Stack:** Next.js App Router (route handler), Stripe Node SDK (already installed, `^22.3.2`), Supabase Postgres, Vitest, a throwaway Node script for live verification (no Playwright needed — this is a server-to-server webhook, not a browser flow).

## Global Constraints

- Handle exactly `checkout.session.completed`. No other Stripe event type changes anything in this pass.
- No new columns beyond the schema-drift fix (which documents columns that already exist live: `organizations.tier_id`, `organizations.stripe_customer_id`, `tiers.stripe_price_id_monthly`, `tiers.stripe_price_id_yearly`).
- Missing `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` → `500`. Invalid signature → `400`, never processed. Missing/malformed metadata on an otherwise-valid event → `400`. Any other event type → `200`, ignored.
- The route must use `createAdminClient()` (service-role), not the per-request `createClient()` — there is no authenticated user session on a webhook call.
- No real Stripe keys exist in this environment. Live verification uses a **local-only**, temporary `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` in `.env.local` (gitignored, removed again after verification) and Stripe SDK's own `webhooks.generateTestHeaderString()` to produce genuinely, cryptographically valid signed test payloads — not mocks.

---

### Task 1: Schema-drift migration

**Files:**
- Create: `supabase/migrations/20260920090000_billing_columns_backfill.sql`

**Interfaces:**
- Consumes: nothing (schema-only task; the columns it documents already exist live and are already reflected in `src/lib/supabase/database.types.ts` — no type regeneration needed this task).
- Produces: nothing new for other tasks to import — this task only reconciles the local migration history with the live schema. Task 3's route reads/writes `organizations.tier_id`, which already exists both live and in the generated types.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260920090000_billing_columns_backfill.sql`:

```sql
-- Backfills the local migration history for four columns that were
-- applied directly to the live database at some point without a
-- corresponding migration file ever being written: organizations.tier_id,
-- organizations.stripe_customer_id, tiers.stripe_price_id_monthly, and
-- tiers.stripe_price_id_yearly. All four already exist live and are
-- already reflected in src/lib/supabase/database.types.ts -- this
-- migration only makes a fresh environment built from this folder match
-- reality. `if not exists` makes it a no-op against the live database.
alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists tier_id uuid references public.tiers(id);

alter table public.tiers
  add column if not exists stripe_price_id_monthly text,
  add column if not exists stripe_price_id_yearly text;
```

- [ ] **Step 2: Apply the migration**

Run `mcp__Supabase__apply_migration` against the project (`uktdipvvnbgzasqlpudl`) with the file's contents, using `20260920090000_billing_columns_backfill` as the migration name. Expected: succeeds with no schema change (the columns already exist), but the migration is now recorded in Supabase's migration history.

- [ ] **Step 3: Confirm no type changes are needed**

Run `npx tsc --noEmit`. Expected: no errors (the columns were already in `database.types.ts` before this task).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260920090000_billing_columns_backfill.sql
git commit -m "Backfill migration history for pre-existing billing columns"
```

---

### Task 2: Pure checkout-metadata extraction

**Files:**
- Create: `src/lib/stripe/extract-checkout-metadata.ts`
- Test: `src/lib/stripe/extract-checkout-metadata.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other tasks).
- Produces:
  - `type CheckoutMetadata = { orgId: string; tierId: string }`
  - `extractCheckoutMetadata(metadata: Record<string, string> | null | undefined): CheckoutMetadata | null`
  - Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stripe/extract-checkout-metadata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractCheckoutMetadata } from "./extract-checkout-metadata";

describe("extractCheckoutMetadata", () => {
  it("extracts orgId and tierId from valid metadata", () => {
    const result = extractCheckoutMetadata({ org_id: "org-1", tier_id: "tier-1" });
    expect(result).toEqual({ orgId: "org-1", tierId: "tier-1" });
  });

  it("returns null when org_id is missing", () => {
    expect(extractCheckoutMetadata({ tier_id: "tier-1" })).toBeNull();
  });

  it("returns null when tier_id is missing", () => {
    expect(extractCheckoutMetadata({ org_id: "org-1" })).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(extractCheckoutMetadata({})).toBeNull();
  });

  it("returns null when metadata is null", () => {
    expect(extractCheckoutMetadata(null)).toBeNull();
  });

  it("returns null when metadata is undefined", () => {
    expect(extractCheckoutMetadata(undefined)).toBeNull();
  });

  it("returns null when org_id is an empty string", () => {
    expect(extractCheckoutMetadata({ org_id: "", tier_id: "tier-1" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/stripe/extract-checkout-metadata.test.ts`
Expected: FAIL — `Cannot find module './extract-checkout-metadata'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/stripe/extract-checkout-metadata.ts`:

```ts
export type CheckoutMetadata = { orgId: string; tierId: string };

export function extractCheckoutMetadata(
  metadata: Record<string, string> | null | undefined,
): CheckoutMetadata | null {
  const orgId = metadata?.org_id;
  const tierId = metadata?.tier_id;
  if (!orgId || !tierId) return null;
  return { orgId, tierId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stripe/extract-checkout-metadata.test.ts`
Expected: PASS — 7/7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe/extract-checkout-metadata.ts src/lib/stripe/extract-checkout-metadata.test.ts
git commit -m "Add pure checkout-session metadata extraction"
```

---

### Task 3: The webhook route

**Files:**
- Create: `src/app/api/billing/webhook/route.ts`

**Interfaces:**
- Consumes: `extractCheckoutMetadata` (Task 2); `getStripeClient` from `@/lib/stripe/client`; `createAdminClient` from `@/lib/supabase/admin`.
- Produces: `POST` handler at `/api/billing/webhook`. No other task depends on this file's internals — it's the terminal integration point, proven correct by Task 4's live verification.

- [ ] **Step 1: Write the route**

Create `src/app/api/billing/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractCheckoutMetadata } from "@/lib/stripe/extract-checkout-metadata";

/**
 * Stripe calls this when a checkout session completes. Applies the tier
 * the customer just paid for -- session.metadata carries org_id/tier_id,
 * set at checkout-creation time in src/app/api/billing/checkout/route.ts,
 * so no price-to-tier lookup is needed. Authenticated by Stripe's own
 * signature scheme rather than a user session, since the caller is
 * Stripe's servers, not a logged-in request; the admin client is required
 * to write past RLS for the same reason (same pattern as
 * src/app/api/tiling/callback/route.ts).
 */
export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Billing isn't configured yet — ask an admin to set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const metadata = extractCheckoutMetadata(event.data.object.metadata);
  if (!metadata) {
    return NextResponse.json(
      { error: "Missing org_id or tier_id in session metadata" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  await supabase
    .from("organizations")
    .update({ tier_id: metadata.tierId })
    .eq("id", metadata.orgId);

  return NextResponse.json({ received: true });
}
```

This route is not unit-tested directly — it's a thin orchestration layer over already-tested pure logic (`extractCheckoutMetadata`) and already-established client helpers (`getStripeClient`, `createAdminClient`), the same convention every other route handler in this codebase follows. Proven correct via Task 4's live verification.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. If `event.data.object.metadata` doesn't typecheck, confirm the `if (event.type !== "checkout.session.completed")` guard above it is written exactly as shown — Stripe's SDK types `event` as a discriminated union keyed on `.type`, and TypeScript only narrows `event.data.object` to `Stripe.Checkout.Session` when the guard is a direct `event.type !== "..."` comparison in an `if`, not a variable holding the comparison's result.

Run: `npx eslint src/app/api/billing/webhook/route.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/webhook/route.ts
git commit -m "Add the Stripe checkout webhook: applies tier_id on checkout.session.completed"
```

---

### Task 4: Live verification

**Files:** none (throwaway verification script and throwaway test data only, not committed)

**Interfaces:**
- Consumes: the running dev server; a throwaway `tiers` row and the real `Demo Organization` row (`423b604d-9d87-4961-bb8f-864e1cf69b2b`, currently `tier_id: null`), both restored/cleaned up afterward; two temporary lines in `.env.local` (gitignored, removed afterward).
- Produces: nothing shipped — a pass/fail report, and full cleanup of throwaway data and temporary env vars.

- [ ] **Step 1: Create a throwaway tier**

Run via `mcp__Supabase__execute_sql` against project `uktdipvvnbgzasqlpudl`:

```sql
insert into public.tiers (id, name, identifier, monthly_price_cents, yearly_price_cents)
values ('00000000-0000-4000-8000-0000000000f2', 'Webhook Test Tier', 'webhook-test-tier', 1000, 10000)
returning id, name;
```

Expected: 1 row returned.

- [ ] **Step 2: Add temporary local-only Stripe config**

Read `.env.local` first to confirm its current exact contents, then append these two lines to it (do not remove or reorder any existing lines):

```
STRIPE_SECRET_KEY=sk_test_local_verification_only
STRIPE_WEBHOOK_SECRET=whsec_local_verification_only
```

`.env.local` is gitignored (`.env*` in `.gitignore`) and never deployed — these values are never real Stripe credentials and are removed again in Step 6.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (background)
Wait for it to report ready (poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` until non-`000`).

- [ ] **Step 4: Write and run the verification script**

Write to `node_modules/.tmp-stripe-webhook-verify.mjs` (so Node resolves the `stripe` package from the project's own `node_modules`):

```js
import Stripe from "stripe";

const BASE_URL = "http://localhost:3000";
const WEBHOOK_SECRET = "whsec_local_verification_only";
const DEMO_ORG_ID = "423b604d-9d87-4961-bb8f-864e1cf69b2b";
const TEST_TIER_ID = "00000000-0000-4000-8000-0000000000f2";

function buildCheckoutCompletedPayload(metadata) {
  return JSON.stringify({
    id: "evt_test_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        metadata,
      },
    },
  });
}

async function postWebhook(payload, signature) {
  return fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

// 1. Valid signature, valid metadata -> 200, tier_id actually applied.
{
  const payload = buildCheckoutCompletedPayload({ org_id: DEMO_ORG_ID, tier_id: TEST_TIER_ID });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const res = await postWebhook(payload, signature);
  const body = await res.json();
  console.log("valid event response:", res.status, body);
  if (res.status !== 200) throw new Error(`FAIL: expected 200, got ${res.status}`);
}

// 2. Invalid signature -> 400, no processing.
{
  const payload = buildCheckoutCompletedPayload({ org_id: DEMO_ORG_ID, tier_id: TEST_TIER_ID });
  const res = await postWebhook(payload, "t=1,v1=not_a_real_signature");
  const body = await res.json();
  console.log("invalid signature response:", res.status, body);
  if (res.status !== 400) throw new Error(`FAIL: expected 400 for bad signature, got ${res.status}`);
}

// 3. Irrelevant event type -> 200, ignored.
{
  const payload = JSON.stringify({
    id: "evt_test_2",
    object: "event",
    type: "customer.created",
    data: { object: { id: "cus_test_1", object: "customer" } },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const res = await postWebhook(payload, signature);
  const body = await res.json();
  console.log("irrelevant event response:", res.status, body);
  if (res.status !== 200) throw new Error(`FAIL: expected 200 for an ignored event type, got ${res.status}`);
}

console.log("ALL CHECKS PASSED");
```

Run: `node --env-file=.env.local node_modules/.tmp-stripe-webhook-verify.mjs`
Expected: `ALL CHECKS PASSED` printed, with the three intermediate status lines showing `200`, `400`, `200` in order.

- [ ] **Step 5: Confirm the database write actually happened**

Run via `mcp__Supabase__execute_sql`:

```sql
select tier_id from public.organizations where id = '423b604d-9d87-4961-bb8f-864e1cf69b2b';
```

Expected: `tier_id = '00000000-0000-4000-8000-0000000000f2'` (the throwaway test tier from Step 1) — proving the valid signed event in the script's check 1 actually wrote to the database, and that the invalid-signature and irrelevant-event checks in checks 2–3 did not change it further.

- [ ] **Step 6: Restore and clean up**

Reset the demo org's tier back to what it was before this task:

```sql
update public.organizations set tier_id = null where id = '423b604d-9d87-4961-bb8f-864e1cf69b2b';
delete from public.tiers where id = '00000000-0000-4000-8000-0000000000f2';
```

Verify the restore:

```sql
select tier_id from public.organizations where id = '423b604d-9d87-4961-bb8f-864e1cf69b2b';
```

Expected: `tier_id = null`.

Remove the throwaway script:

```bash
rm node_modules/.tmp-stripe-webhook-verify.mjs
```

Remove the two temporary lines from `.env.local` added in Step 2 (leave every other line untouched):

```bash
sed -i '/^STRIPE_SECRET_KEY=sk_test_local_verification_only$/d; /^STRIPE_WEBHOOK_SECRET=whsec_local_verification_only$/d' .env.local
```

Read `.env.local` afterward to confirm only the original two lines (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) remain.

Stop the dev server.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (137 pre-existing + 7 new from Task 2 = 144/144).

---

## Final check

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx vitest run` — 144/144 passing
- [ ] Live verification script printed `ALL CHECKS PASSED`, and the direct DB query in Step 5 confirmed the write
- [ ] Throwaway tier row deleted, demo org's `tier_id` restored to `null`, `.env.local` back to its original two lines
