import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { verifyStripeWebhook } from "./verify-webhook";

const stripe = new Stripe("sk_test_dummy");
const secret = "whsec_test_secret";
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { metadata: { org_id: "o", tier_id: "t" } } },
});

describe("verifyStripeWebhook", () => {
  it("returns the event for a correctly signed payload", async () => {
    const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
    const event = await verifyStripeWebhook(stripe, payload, signature, secret);
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("returns null for a bad signature", async () => {
    const event = await verifyStripeWebhook(stripe, payload, "t=1,v1=deadbeef", secret);
    expect(event).toBeNull();
  });

  it("returns null when the signature header is missing", async () => {
    expect(await verifyStripeWebhook(stripe, payload, null, secret)).toBeNull();
  });
});
