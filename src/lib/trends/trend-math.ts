export interface TrendDelta {
  currentPeriodCount: number;
  previousPeriodCount: number;
  absoluteChange: number;
  percentChange: number | null;
  direction: "up" | "down" | "flat";
}

export interface Sparkline {
  points: number[];
}

export function computeTrendDelta(currentPeriodCount: number, previousPeriodCount: number): TrendDelta {
  const absoluteChange = currentPeriodCount - previousPeriodCount;
  const percentChange = previousPeriodCount === 0 ? null : (absoluteChange / previousPeriodCount) * 100;
  const direction: TrendDelta["direction"] = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";

  return { currentPeriodCount, previousPeriodCount, absoluteChange, percentChange, direction };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_DAYS = 30;

function utcDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Buckets timestamps into 30 daily counts, oldest first, by UTC calendar
 * date. `now` is a parameter (not read from the system clock) so this stays
 * deterministic and testable — same pattern as `getGreeting(date, name)`. */
export function buildSparkline(timestamps: Date[], now: Date): Sparkline {
  const points = new Array(SPARKLINE_DAYS).fill(0);
  const today = utcDateOnly(now);

  for (const ts of timestamps) {
    const daysAgo = Math.round((today - utcDateOnly(ts)) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < SPARKLINE_DAYS) {
      points[SPARKLINE_DAYS - 1 - daysAgo] += 1;
    }
  }

  return { points };
}
