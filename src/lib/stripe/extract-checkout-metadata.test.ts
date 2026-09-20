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
