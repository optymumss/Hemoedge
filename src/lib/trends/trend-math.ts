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

export interface TrendWithSparkline extends TrendDelta {
  sparkline: Sparkline;
}

export function computeTrendDelta(currentPeriodCount: number, previousPeriodCount: number): TrendDelta {
  const absoluteChange = currentPeriodCount - previousPeriodCount;
  const percentChange = previousPeriodCount === 0 ? null : (absoluteChange / previousPeriodCount) * 100;
  const direction: TrendDelta["direction"] = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";

  return { currentPeriodCount, previousPeriodCount, absoluteChange, percentChange, direction };
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const SPARKLINE_DAYS = 30;

function utcDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Buckets timestamps into 30 daily counts, oldest first, by UTC calendar
 * date. `now` is a parameter (not read from the system clock) so this stays
 * deterministic and testable — same pattern as `getGreeting(date, name)`.
 * A timestamp after `now` (clock skew, or a DB row written moments after
 * `now` was captured) still lands in today's bucket since only
 * `daysAgo >= 0` is required — a known, intentionally tiny asymmetry with
 * `buildTrend`'s strict `ts < now` cutoff for the current-period count. */
export function buildSparkline(timestamps: Date[], now: Date): Sparkline {
  const points = new Array<number>(SPARKLINE_DAYS).fill(0);
  const today = utcDateOnly(now);

  for (const ts of timestamps) {
    const daysAgo = Math.round((today - utcDateOnly(ts)) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < SPARKLINE_DAYS) {
      points[SPARKLINE_DAYS - 1 - daysAgo] += 1;
    }
  }

  return { points };
}

/** Classifies raw timestamps into the current period [now-30d, now) and
 * previous period [now-60d, now-30d), then builds both the delta and the
 * sparkline from the same input. This implements the window-boundary
 * Global Constraint, so it lives here (pure, tested) rather than in the
 * Supabase-touching wrapper that calls it. */
export function buildTrend(timestamps: Date[], now: Date): TrendWithSparkline {
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  let currentPeriodCount = 0;
  let previousPeriodCount = 0;
  for (const ts of timestamps) {
    if (ts >= thirtyDaysAgo && ts < now) currentPeriodCount++;
    else if (ts >= sixtyDaysAgo && ts < thirtyDaysAgo) previousPeriodCount++;
  }

  return { ...computeTrendDelta(currentPeriodCount, previousPeriodCount), sparkline: buildSparkline(timestamps, now) };
}

/** A fresh flat/zero trend, used when a metric's query fails. Returns a new
 * object each call (not a shared singleton) so a consumer that ever
 * mutates a sparkline in place (e.g. reversing it for a right-to-left
 * chart) can't corrupt every other degraded metric in this server
 * process. */
export function flatTrend(): TrendWithSparkline {
  return { ...computeTrendDelta(0, 0), sparkline: { points: new Array<number>(SPARKLINE_DAYS).fill(0) } };
}
