import { describe, it, expect } from "vitest";
import { formatCountTrendLabel, formatPassRateTrendLabel } from "./format-trend-label";

describe("formatCountTrendLabel", () => {
  it("formats a positive percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 5, previousPeriodCount: 4, absoluteChange: 1, percentChange: 25, direction: "up" }),
    ).toBe("+25% vs last month");
  });

  it("formats a negative percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 3, previousPeriodCount: 6, absoluteChange: -3, percentChange: -50, direction: "down" }),
    ).toBe("-50% vs last month");
  });

  it("rounds a fractional percent change", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 4, previousPeriodCount: 3, absoluteChange: 1, percentChange: 33.333, direction: "up" }),
    ).toBe("+33% vs last month");
  });

  it("shows New when there's new activity but no prior baseline", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 3, previousPeriodCount: 0, absoluteChange: 3, percentChange: null, direction: "up" }),
    ).toBe("New");
  });

  it("shows No change when both periods are zero", () => {
    expect(
      formatCountTrendLabel({ currentPeriodCount: 0, previousPeriodCount: 0, absoluteChange: 0, percentChange: null, direction: "flat" }),
    ).toBe("No change");
  });
});

describe("formatPassRateTrendLabel", () => {
  it("formats a positive percentage-point change", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 80, previousPassRate: 60, percentagePointChange: 20, direction: "up", sparkline: { points: [] } }),
    ).toBe("+20pp vs last month");
  });

  it("formats a negative percentage-point change", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 50, previousPassRate: 80, percentagePointChange: -30, direction: "down", sparkline: { points: [] } }),
    ).toBe("-30pp vs last month");
  });

  it("shows New when there's a current rate but no prior baseline", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: 72, previousPassRate: null, percentagePointChange: null, direction: "flat", sparkline: { points: [] } }),
    ).toBe("New");
  });

  it("shows No data when there's no current rate either", () => {
    expect(
      formatPassRateTrendLabel({ currentPassRate: null, previousPassRate: null, percentagePointChange: null, direction: "flat", sparkline: { points: [] } }),
    ).toBe("No data");
  });
});
