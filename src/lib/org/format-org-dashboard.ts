export type AtRiskReason = "inactive" | "overdue_onboarding" | "low_performance";

const REASON_LABELS: Record<AtRiskReason, string> = {
  inactive: "Inactive 14+ days",
  overdue_onboarding: "Onboarding overdue",
  low_performance: "Below pass threshold",
};

export function formatAtRiskReasonLabel(reason: AtRiskReason): string {
  return REASON_LABELS[reason];
}

export function formatSeatsSummary(seatsUsed: number, seatsTotal: number | null): string {
  return seatsTotal === null ? `${seatsUsed} (unlimited)` : `${seatsUsed} / ${seatsTotal}`;
}
