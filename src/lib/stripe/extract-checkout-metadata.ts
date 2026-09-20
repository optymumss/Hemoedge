export type CheckoutMetadata = { orgId: string; tierId: string };

export function extractCheckoutMetadata(
  metadata: Record<string, string> | null | undefined,
): CheckoutMetadata | null {
  const orgId = metadata?.org_id;
  const tierId = metadata?.tier_id;
  if (!orgId || !tierId) return null;
  return { orgId, tierId };
}
