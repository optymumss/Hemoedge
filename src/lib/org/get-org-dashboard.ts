import { createClient } from "@/lib/supabase/server";
import { computePassRateTrend, buildTrendFromDailyCounts, flatTrend, type PassRateTrend, type TrendWithSparkline } from "@/lib/trends/trend-math";
import type { AtRiskReason } from "@/lib/org/format-org-dashboard";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OrgDashboardKpis = {
  learnerCount: number;
  seatsUsed: number;
  seatsTotal: number | null;
  passRateTrend: Omit<PassRateTrend, "sparkline">;
  cpdEarned: number;
  cpdAvailable: number;
  certificatesIssued: number;
};

export type AtRiskLearner = {
  userId: string;
  name: string;
  email: string;
  lastActivityAt: string | null;
  reasons: AtRiskReason[];
};

export type OrgWeakestModule = {
  moduleId: string;
  title: string;
  attemptCount: number;
  averageScore: number;
};

export type OnboardingPlanCompletion = {
  planId: string;
  name: string;
  assignedCount: number;
  completedCount: number;
  percentComplete: number;
};

const FLAT_KPIS: OrgDashboardKpis = {
  learnerCount: 0,
  seatsUsed: 0,
  seatsTotal: null,
  passRateTrend: { currentPassRate: null, previousPassRate: null, percentagePointChange: null, direction: "flat" },
  cpdEarned: 0,
  cpdAvailable: 0,
  certificatesIssued: 0,
};

export async function getOrgDashboardKpis(supabase: SupabaseClient, orgId: string): Promise<OrgDashboardKpis> {
  try {
    const { data, error } = await supabase.rpc("org_dashboard_kpis", { p_org_id: orgId }).single();
    if (error || !data) return FLAT_KPIS;

    return {
      learnerCount: data.learner_count,
      seatsUsed: data.seats_used,
      seatsTotal: data.seats_total,
      passRateTrend: computePassRateTrend(data.passed_current, data.attempts_current, data.passed_previous, data.attempts_previous),
      cpdEarned: data.cpd_earned,
      cpdAvailable: data.cpd_available,
      certificatesIssued: data.certificates_issued,
    };
  } catch {
    return FLAT_KPIS;
  }
}

export async function getAtRiskLearners(supabase: SupabaseClient, orgId: string): Promise<{ total: number; top: AtRiskLearner[] }> {
  try {
    const { data, error } = await supabase.rpc("org_at_risk_learners", { p_org_id: orgId });
    if (error || !data) return { total: 0, top: [] };

    const learners: AtRiskLearner[] = data.map((row) => ({
      userId: row.user_id,
      name: row.name,
      email: row.email,
      lastActivityAt: row.last_activity_at,
      reasons: (row.reasons ?? []) as AtRiskReason[],
    }));
    return { total: learners.length, top: learners.slice(0, 5) };
  } catch {
    return { total: 0, top: [] };
  }
}

export async function getOrgWeakestModules(supabase: SupabaseClient, orgId: string, limit = 5): Promise<OrgWeakestModule[]> {
  try {
    const { data, error } = await supabase.rpc("org_weakest_modules", { p_org_id: orgId, p_limit: limit });
    if (error || !data) return [];

    return data.map((row) => ({
      moduleId: row.module_id,
      title: row.title,
      attemptCount: row.attempt_count,
      averageScore: Number(row.average_score),
    }));
  } catch {
    return [];
  }
}

export async function getOnboardingCompletion(supabase: SupabaseClient, orgId: string): Promise<OnboardingPlanCompletion[]> {
  try {
    const { data, error } = await supabase.rpc("org_onboarding_completion", { p_org_id: orgId });
    if (error || !data) return [];

    return data.map((row) => ({
      planId: row.plan_id,
      name: row.name,
      assignedCount: row.assigned_count,
      completedCount: row.completed_count,
      percentComplete: row.assigned_count === 0 ? 0 : Math.round((row.completed_count / row.assigned_count) * 100),
    }));
  } catch {
    return [];
  }
}

export async function getOrgActivityTrend(supabase: SupabaseClient, orgId: string): Promise<TrendWithSparkline> {
  try {
    const { data, error } = await supabase.rpc("org_daily_activity_counts", { p_org_id: orgId });
    if (error || !data) return flatTrend();

    const dailyCounts = [...data].sort((a, b) => a.day_offset - b.day_offset).map((row) => row.event_count);
    return buildTrendFromDailyCounts(dailyCounts);
  } catch {
    return flatTrend();
  }
}
