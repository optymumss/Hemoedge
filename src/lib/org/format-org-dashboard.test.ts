import { describe, it, expect } from "vitest";
import { formatAtRiskReasonLabel, formatSeatsSummary } from "./format-org-dashboard";

describe("formatAtRiskReasonLabel", () => {
  it("labels inactive", () => {
    expect(formatAtRiskReasonLabel("inactive")).toBe("Inactive 14+ days");
  });

  it("labels overdue onboarding", () => {
    expect(formatAtRiskReasonLabel("overdue_onboarding")).toBe("Onboarding overdue");
  });

  it("labels low performance", () => {
    expect(formatAtRiskReasonLabel("low_performance")).toBe("Below pass threshold");
  });
});

describe("formatSeatsSummary", () => {
  it("shows used / total when a seat cap exists", () => {
    expect(formatSeatsSummary(8, 20)).toBe("8 / 20");
  });

  it("shows just the used count when seats are unlimited (null total)", () => {
    expect(formatSeatsSummary(8, null)).toBe("8 (unlimited)");
  });

  it("handles zero used with a cap", () => {
    expect(formatSeatsSummary(0, 5)).toBe("0 / 5");
  });
});
