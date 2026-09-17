import type { TrendDelta, PassRateTrend } from "@/lib/trends/trend-math";

/** "+25% vs last month" / "-10% vs last month", or "New" when there's
 * activity now but no prior-period baseline to compare against, or
 * "No change" when both periods are genuinely zero. */
export function formatCountTrendLabel(trend: TrendDelta): string {
  if (trend.percentChange === null) {
    return trend.currentPeriodCount > 0 ? "New" : "No change";
  }
  const rounded = Math.round(trend.percentChange);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs last month`;
}

/** Percentage POINTS, not percent-of-percent — "+12pp" means the pass rate
 * moved 12 points, not that it grew by 12% of its prior value. */
export function formatPassRateTrendLabel(trend: PassRateTrend): string {
  if (trend.percentagePointChange === null) {
    return trend.currentPassRate !== null ? "New" : "No data";
  }
  const rounded = Math.round(trend.percentagePointChange);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}pp vs last month`;
}
