# Stripe Webhook — Design Spec

## Problem

`src/app/api/billing/checkout/route.ts` creates a real Stripe Checkout Session with `metadata: { org_id, tier_id }`, but nothing in the codebase ever reads that metadata back. The only way `organizations.tier_id` changes today is a Super Admin manually editing it via `admin/organizations/[id]/tier-form.tsx`. A customer can complete payment through Stripe Checkout and their org's tier never updates — the org-billing page's own copy ("Subscription started — it may take a moment to reflect here") implies a reconciliation step that doesn't exist.

## Scope

Handle exactly **`checkout.session.completed`** — the one Stripe event with a real trigger path in this app today. There is no "manage billing" / customer portal link anywhere in the UI, so subscription updates, renewals, or cancellations can't currently be initiated from the customer side; handling those event types now would be speculative. Applying the checkout event is a direct field update: the session's own metadata already carries `org_id` and `tier_id`, set at checkout-creation time — no price-to-tier reverse lookup is needed.

Out of scope: `customer.subscription.updated`/`.deleted`, a customer billing portal, storing `stripe_subscription_id`, any new columns beyond the schema-drift fix below.

## A bundled schema-drift fix

`organizations.tier_id` (uuid, FK to `tiers.id`), `organizations.stripe_customer_id` (text), and `tiers.stripe_price_id_monthly`/`stripe_price_id_yearly` (text) already exist in the **live** Supabase project (confirmed directly against `src/lib/supabase/database.types.ts`, including the `organizations_tier_id_fkey` constraint) — but no local migration file ever created them; they were applied directly at some point and the file was never written. This directly affects this work: a fresh environment built from `supabase/migrations/` alone would be missing the exact columns this webhook writes to. Task 1 adds one migration with `add column if not exists` guards, matching the real current schema exactly, so the local migration history catches up to reality without altering anything live.

## The route

`src/app/api/billing/webhook/route.ts`, modeled directly on the existing `src/app/api/tiling/callback/route.ts` — the established pattern in this codebase for "an external, unauthenticated-by-user-session caller writes past RLS via a verified secret and the service-role `createAdminClient()`":

1. Read the **raw** request body via `request.text()` (Stripe signs raw bytes, not parsed JSON) and the `stripe-signature` header.
2. `getStripeClient()` missing (no `STRIPE_SECRET_KEY`) → `500 { error: "Billing isn't configured yet" }`, mirroring the checkout route's own config-missing message. `STRIPE_WEBHOOK_SECRET` missing → same.
3. Verify via `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. Throws → `400 { error: "Invalid signature" }`.
4. `event.type !== "checkout.session.completed"` → `200 { received: true }` (acknowledge and ignore; Stripe retries on non-2xx responses, and only this one event type matters here).
5. `extractCheckoutMetadata(session)` (pure, unit-tested) parses and validates `session.metadata`. Returns `null` → `400 { error: "Missing org_id or tier_id in session metadata" }`.
6. Otherwise: `createAdminClient().from("organizations").update({ tier_id: tierId }).eq("id", orgId)` → `200 { received: true }`.

Applying the same event twice (Stripe's at-least-once delivery guarantee) sets the same value both times — naturally idempotent, no delivery-dedup tracking needed.

## Components

### `src/lib/stripe/extract-checkout-metadata.ts` (pure, unit-tested)

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

### `src/app/api/billing/webhook/route.ts`

Ties together `getStripeClient()` (existing), `extractCheckoutMetadata` (new), and `createAdminClient()` (existing) per the flow above. No new library code beyond the pure extraction function — the route itself, like `checkout/route.ts` and `tiling/callback/route.ts`, is a thin orchestration layer proven correct by live verification, not unit tests.

## Error handling

- Missing config (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`) → `500`, matching the checkout route's precedent for the same condition.
- Invalid signature → `400`, never processed — prevents a forged request from an arbitrary caller from mutating `organizations.tier_id`.
- Malformed/missing metadata on an otherwise-validly-signed event → `400`, logged implicitly via the response Stripe's dashboard records; this would only happen if the checkout route's own metadata-setting code regresses, not from external input.
- Any other event type → `200`, silently ignored. This is correct behavior, not a missed case: Stripe sends every subscribed event type to every configured endpoint, and an endpoint is expected to ignore what it doesn't handle.

## Testing

No real Stripe keys are configured in this environment (confirmed: `STRIPE_SECRET_KEY` absent from `.env.local`), so true end-to-end verification against Stripe's real servers is not possible. However, Stripe's signature scheme and its SDK's `stripe.webhooks.generateTestHeaderString()` helper are pure cryptography with no network call — genuine, non-mocked verification of the entire route (signature check, metadata extraction, database write) is possible using a **local-only**, temporary `STRIPE_WEBHOOK_SECRET` (and a placeholder `STRIPE_SECRET_KEY`, since `getStripeClient()` only needs a truthy string to construct the SDK object) added to `.env.local` for the duration of live verification, then removed. `.env.local` is gitignored and never deployed, so this touches nothing outside this local session.

- Unit tests (`src/lib/stripe/extract-checkout-metadata.test.ts`): valid metadata; missing `org_id`; missing `tier_id`; both missing; `null`/`undefined` metadata.
- Live verification: generate a validly-signed `checkout.session.completed` test payload (via `stripe.webhooks.generateTestHeaderString`) targeting a real demo org, POST it at the running dev server, and confirm `organizations.tier_id` actually changes in the database afterward (then restore it). Separately confirm an invalidly-signed payload is rejected with `400` and produces no database write, and that an irrelevant event type (e.g. `customer.created`) returns `200` with no database write.
