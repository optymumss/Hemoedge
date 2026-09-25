import Stripe from "stripe";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Async + SubtleCrypto variant of stripe.webhooks.constructEvent -- the
 * synchronous version depends on Node's crypto.createHmac, which Stripe
 * doesn't support on Cloudflare Workers. Returns null on any failure so
 * the route can map it to a 400 without try/catch noise.
 */
export async function verifyStripeWebhook(
  stripe: Stripe,
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<Stripe.Event | null> {
  if (!signature) return null;
  try {
    return await stripe.webhooks.constructEventAsync(rawBody, signature, secret, undefined, cryptoProvider);
  } catch {
    return null;
  }
}
