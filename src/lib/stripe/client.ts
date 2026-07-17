import Stripe from "stripe";

let client: Stripe | null = null;

/** Returns null when STRIPE_SECRET_KEY isn't set, so callers can surface a clean config error. */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
