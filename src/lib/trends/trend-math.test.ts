import { describe, it, expect } from "vitest";
import { computeTrendDelta, buildSparkline, buildTrend, DAY_MS, computePassRateTrend, flatPassRateTrend } from "./trend-math";

describe("computeTrendDelta", () => {
  it("computes a positive delta when the current period is higher", () => {
    const result = computeTrendDelta(10, 5);
    expect(result).toEqual({
      currentPeriodCount: 10,
      previousPeriodCount: 5,
      absoluteChange: 5,
      percentChange: 100,
      direction: "up",
    });
  });

  it("computes a negative delta when the current period is lower", () => {
    const result = computeTrendDelta(5, 10);
    expect(result.absoluteChange).toBe(-5);
    expect(result.percentChange).toBe(-50);
    expect(result.direction).toBe("down");
  });

  it("is flat when both periods are equal and non-zero", () => {
    const result = computeTrendDelta(5, 5);
    expect(result.absoluteChange).toBe(0);
    expect(result.percentChange).toBe(0);
    expect(result.direction).toBe("flat");
  });

  it("returns a null percentChange when the previous period was zero, even with new activity", () => {
    const result = computeTrendDelta(3, 0);
    expect(result.absoluteChange).toBe(3);
    expect(result.percentChange).toBeNull();
    expect(result.direction).toBe("up");
  });

  it("is flat with a null percentChange when both periods are zero", () => {
    const result = computeTrendDelta(0, 0);
    expect(result.absoluteChange).toBe(0);
    expect(result.percentChange).toBeNull();
    expect(result.direction).toBe("flat");
  });
});

describe("buildSparkline", () => {
  const now = new Date(Date.UTC(2026, 8, 16, 12, 0, 0)); // 2026-09-16 12:00 UTC

  it("returns 30 zeroed points when there are no timestamps", () => {
    const result = buildSparkline([], now);
    expect(result.points).toHaveLength(30);
    expect(result.points.every((p) => p === 0)).toBe(true);
  });

  it("buckets a timestamp from today into the last (most recent) point", () => {
    const today = new Date(Date.UTC(2026, 8, 16, 3, 0, 0));
    const result = buildSparkline([today], now);
    expect(result.points[29]).toBe(1);
    expect(result.points.slice(0, 29).every((p) => p === 0)).toBe(true);
  });

  it("buckets a timestamp from 29 days ago into the first (oldest) point", () => {
    const twentyNineDaysAgo = new Date(Date.UTC(2026, 7, 18, 9, 0, 0)); // 2026-08-18
    const result = buildSparkline([twentyNineDaysAgo], now);
    expect(result.points[0]).toBe(1);
    expect(result.points.slice(1).every((p) => p === 0)).toBe(true);
  });

  it("excludes a timestamp from exactly 30 days ago (outside the window)", () => {
    const thirtyDaysAgo = new Date(Date.UTC(2026, 7, 17, 9, 0, 0)); // 2026-08-17
    const result = buildSparkline([thirtyDaysAgo], now);
    expect(result.points.every((p) => p === 0)).toBe(true);
  });

  it("counts multiple timestamps on the same UTC day into one bucket", () => {
    const morning = new Date(Date.UTC(2026, 8, 16, 1, 0, 0));
    const evening = new Date(Date.UTC(2026, 8, 16, 23, 0, 0));
    const result = buildSparkline([morning, evening], now);
    expect(result.points[29]).toBe(2);
  });
});

describe("buildTrend", () => {
  const now = new Date(Date.UTC(2026, 8, 16, 12, 0, 0)); // 2026-09-16 12:00 UTC

  it("counts a timestamp at exactly now as neither period (current period's exclusive upper edge)", () => {
    const result = buildTrend([now], now);
    expect(result.currentPeriodCount).toBe(0);
    expect(result.previousPeriodCount).toBe(0);
  });

  it("counts a timestamp at exactly now - 30 days as current (the current period's inclusive lower edge)", () => {
    const exactlyThirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const result = buildTrend([exactlyThirtyDaysAgo], now);
    expect(result.currentPeriodCount).toBe(1);
    expect(result.previousPeriodCount).toBe(0);
  });

  it("counts a timestamp at exactly now - 60 days as previous (the previous period's inclusive lower edge)", () => {
    const exactlySixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
    const result = buildTrend([exactlySixtyDaysAgo], now);
    expect(result.currentPeriodCount).toBe(0);
    expect(result.previousPeriodCount).toBe(1);
  });

  it("excludes a timestamp older than now - 60 days from both periods", () => {
    const olderThanSixtyDays = new Date(now.getTime() - 61 * DAY_MS);
    const result = buildTrend([olderThanSixtyDays], now);
    expect(result.currentPeriodCount).toBe(0);
    expect(result.previousPeriodCount).toBe(0);
  });

  it("builds a sparkline alongside the delta from the same timestamps", () => {
    const today = new Date(Date.UTC(2026, 8, 16, 3, 0, 0));
    const result = buildTrend([today], now);
    expect(result.sparkline.points).toHaveLength(30);
    expect(result.sparkline.points[29]).toBe(1);
  });
});

describe("computePassRateTrend", () => {
  it("computes a positive percentage-point change", () => {
    const result = computePassRateTrend(8, 10, 6, 10);
    expect(result.currentPassRate).toBe(80);
    expect(result.previousPassRate).toBe(60);
    expect(result.percentagePointChange).toBe(20);
    expect(result.direction).toBe("up");
  });

  it("computes a negative percentage-point change", () => {
    const result = computePassRateTrend(5, 10, 8, 10);
    expect(result.percentagePointChange).toBe(-30);
    expect(result.direction).toBe("down");
  });

  it("is flat when the pass rate is unchanged", () => {
    const result = computePassRateTrend(7, 10, 7, 10);
    expect(result.percentagePointChange).toBe(0);
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when the current period has zero attempts", () => {
    const result = computePassRateTrend(0, 0, 6, 10);
    expect(result.currentPassRate).toBeNull();
    expect(result.percentagePointChange).toBeNull();
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when the previous period has zero attempts", () => {
    const result = computePassRateTrend(5, 5, 0, 0);
    expect(result.previousPassRate).toBeNull();
    expect(result.percentagePointChange).toBeNull();
    expect(result.direction).toBe("flat");
  });

  it("returns null and flat when both periods have zero attempts", () => {
    const result = computePassRateTrend(0, 0, 0, 0);
    expect(result.currentPassRate).toBeNull();
    expect(result.previousPassRate).toBeNull();
    expect(result.direction).toBe("flat");
  });
});

describe("flatPassRateTrend", () => {
  it("returns a fresh, fully null/zero trend on each call", () => {
    const a = flatPassRateTrend();
    const b = flatPassRateTrend();
    expect(a).not.toBe(b);
    expect(a.currentPassRate).toBeNull();
    expect(a.previousPassRate).toBeNull();
    expect(a.percentagePointChange).toBeNull();
    expect(a.direction).toBe("flat");
    expect(a.sparkline.points).toHaveLength(30);
    expect(a.sparkline.points.every((p) => p === 0)).toBe(true);
  });
});
