import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { getStripeClient } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: "No organization to bill." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const tierId = typeof body?.tier_id === "string" ? body.tier_id : "";
  const interval = body?.interval === "yearly" ? "yearly" : "monthly";
  if (!tierId) {
    return NextResponse.json({ error: "A tier is required." }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing isn't configured yet — ask an admin to set STRIPE_SECRET_KEY." },
      { status: 503 },
    );
  }

  const supabase = await createClient();

  const { data: tier } = await supabase
    .from("tiers")
    .select("name, stripe_price_id_monthly, stripe_price_id_yearly")
    .eq("id", tierId)
    .single();

  const priceId =
    interval === "yearly" ? tier?.stripe_price_id_yearly : tier?.stripe_price_id_monthly;

  if (!tier || !priceId) {
    return NextResponse.json(
      { error: "This tier isn't linked to a Stripe price yet — ask an admin to set one up." },
      { status: 400 },
    );
  }

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", org.id)
    .single();

  let customerId = orgRow?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/org/billing?checkout=success`,
    cancel_url: `${origin}/org/billing?checkout=cancelled`,
    metadata: { org_id: org.id, tier_id: tierId },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe didn't return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
