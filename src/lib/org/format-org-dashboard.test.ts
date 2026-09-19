import { describe, it, expect } from "vitest";
import {
  formatAtRiskReasonLabel,
  formatSeatsSummary,
  formatActivityHeadline,
  getReasonBadgeClasses,
  getAtRiskSeverityDotClass,
  getScoreTierBarClass,
} from "./format-org-dashboard";

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

describe("formatActivityHeadline", () => {
  it("formats a positive percent change", () => {
    expect(formatActivityHeadline({ currentPeriodCount: 61, previousPeriodCount: 50, absoluteChange: 11, percentChange: 22, direction: "up" })).toBe(
      "Your team's engagement is up 22% this month.",
    );
  });

  it("formats a negative percent change using the absolute value", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 40, previousPeriodCount: 50, absoluteChange: -10, percentChange: -20, direction: "down" }),
    ).toBe("Your team's engagement is down 20% this month.");
  });

  it("is flat when the change is exactly zero", () => {
    expect(formatActivityHeadline({ currentPeriodCount: 50, previousPeriodCount: 50, absoluteChange: 0, percentChange: 0, direction: "flat" })).toBe(
      "Your team's engagement is flat this month.",
    );
  });

  it("reports new activity when there's no prior baseline but current activity exists", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 5, previousPeriodCount: 0, absoluteChange: 5, percentChange: null, direction: "up" }),
    ).toBe("Your team has new activity this month.");
  });

  it("reports no activity when both periods are zero", () => {
    expect(
      formatActivityHeadline({ currentPeriodCount: 0, previousPeriodCount: 0, absoluteChange: 0, percentChange: null, direction: "flat" }),
    ).toBe("Your team hasn't had any activity in the last 30 days.");
  });
});

describe("getReasonBadgeClasses", () => {
  it("maps each reason to its own semantic token pair", () => {
    expect(getReasonBadgeClasses("inactive")).toBe("bg-warning-soft text-warning-soft-ink");
    expect(getReasonBadgeClasses("overdue_onboarding")).toBe("bg-info-soft text-info-soft-ink");
    expect(getReasonBadgeClasses("low_performance")).toBe("bg-danger-soft text-danger-soft-ink");
  });
});

describe("getAtRiskSeverityDotClass", () => {
  it("prioritizes low_performance (danger) over the other reasons", () => {
    expect(getAtRiskSeverityDotClass(["inactive", "overdue_onboarding", "low_performance"])).toBe("bg-danger");
  });

  it("prioritizes overdue_onboarding (info) over inactive alone", () => {
    expect(getAtRiskSeverityDotClass(["inactive", "overdue_onboarding"])).toBe("bg-info");
  });

  it("falls back to warning for inactive alone", () => {
    expect(getAtRiskSeverityDotClass(["inactive"])).toBe("bg-warning");
  });
});

describe("getScoreTierBarClass", () => {
  it("is danger below 70", () => {
    expect(getScoreTierBarClass(69)).toBe("bg-danger");
  });

  it("is warning from 70 up to 89", () => {
    expect(getScoreTierBarClass(70)).toBe("bg-warning");
    expect(getScoreTierBarClass(89)).toBe("bg-warning");
  });

  it("is success at 90 and above", () => {
    expect(getScoreTierBarClass(90)).toBe("bg-success");
    expect(getScoreTierBarClass(100)).toBe("bg-success");
  });
});
