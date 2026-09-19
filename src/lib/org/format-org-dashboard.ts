import type { TrendDelta } from "@/lib/trends/trend-math";

export type AtRiskReason = "inactive" | "overdue_onboarding" | "low_performance";

const REASON_LABELS: Record<AtRiskReason, string> = {
  inactive: "Inactive 14+ days",
  overdue_onboarding: "Onboarding overdue",
  low_performance: "Below pass threshold",
};

export function formatAtRiskReasonLabel(reason: AtRiskReason): string {
  return REASON_LABELS[reason];
}

const REASON_BADGE_CLASSES: Record<AtRiskReason, string> = {
  inactive: "bg-warning-soft text-warning-soft-ink",
  overdue_onboarding: "bg-info-soft text-info-soft-ink",
  low_performance: "bg-danger-soft text-danger-soft-ink",
};

export function getReasonBadgeClasses(reason: AtRiskReason): string {
  return REASON_BADGE_CLASSES[reason];
}

/** Highest-severity reason wins: a learner with both an activity problem
 * and a performance problem should show the more urgent color. Every
 * caller today only passes non-empty arrays (org_at_risk_learners never
 * returns a row with zero reasons) — the fallback exists only so this
 * function is total. */
const SEVERITY_PRIORITY: AtRiskReason[] = ["low_performance", "overdue_onboarding", "inactive"];
const SEVERITY_DOT_CLASSES: Record<AtRiskReason, string> = {
  low_performance: "bg-danger",
  overdue_onboarding: "bg-info",
  inactive: "bg-warning",
};

export function getAtRiskSeverityDotClass(reasons: AtRiskReason[]): string {
  for (const reason of SEVERITY_PRIORITY) {
    if (reasons.includes(reason)) return SEVERITY_DOT_CLASSES[reason];
  }
  return "bg-ink-faint";
}

export function getScoreTierBarClass(score: number): string {
  if (score < 70) return "bg-danger";
  if (score < 90) return "bg-warning";
  return "bg-success";
}

export function formatSeatsSummary(seatsUsed: number, seatsTotal: number | null): string {
  return seatsTotal === null ? `${seatsUsed} (unlimited)` : `${seatsUsed} / ${seatsTotal}`;
}

/** The hero card's headline sentence. Distinct from trend-math.ts's
 * formatCountTrendLabel (which produces short badge text like "+25% vs
 * last month") because the hero card needs a full sentence, not a badge. */
export function formatActivityHeadline(trend: TrendDelta): string {
  if (trend.percentChange === null) {
    return trend.currentPeriodCount > 0
      ? "Your team has new activity this month."
      : "Your team hasn't had any activity in the last 30 days.";
  }
  const rounded = Math.round(trend.percentChange);
  if (rounded > 0) return `Your team's engagement is up ${rounded}% this month.`;
  if (rounded < 0) return `Your team's engagement is down ${Math.abs(rounded)}% this month.`;
  return "Your team's engagement is flat this month.";
}
