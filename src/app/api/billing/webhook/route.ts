import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractCheckoutMetadata } from "@/lib/stripe/extract-checkout-metadata";
import { verifyStripeWebhook } from "@/lib/stripe/verify-webhook";

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

  const event = await verifyStripeWebhook(stripe, rawBody, signature, webhookSecret);
  if (!event) {
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
