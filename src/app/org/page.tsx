import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import {
  getOrgDashboardKpis,
  getAtRiskLearners,
  getOrgWeakestModules,
  getOnboardingCompletion,
} from "@/lib/org/get-org-dashboard";
import { formatPassRateTrendLabel } from "@/lib/learner/format-trend-label";
import { formatAtRiskReasonLabel, formatSeatsSummary } from "@/lib/org/format-org-dashboard";

export default async function OrgHome() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const supabase = await createClient();
  const [kpis, atRisk, weakestModules, onboarding] = await Promise.all([
    getOrgDashboardKpis(supabase, org.id),
    getAtRiskLearners(supabase, org.id),
    getOrgWeakestModules(supabase, org.id),
    getOnboardingCompletion(supabase, org.id),
  ]);

  const passRateLabel = formatPassRateTrendLabel({ ...kpis.passRateTrend, sparkline: { points: [] } });

  return (
    <div>
      <h1 className="text-xl font-semibold">{org.name}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Manage your roster, choose what your learners study from the published catalog, and track team progress.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Learners</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.learnerCount}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Avg Quiz Pass Rate</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.passRateTrend.currentPassRate === null ? "—" : `${Math.round(kpis.passRateTrend.currentPassRate)}%`}
          </p>
          <p className="mt-1 text-xs text-ink-dim">{passRateLabel}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">CPD Points</p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis.cpdEarned} / {kpis.cpdAvailable}
          </p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Certificates Issued</p>
          <p className="mt-1 text-2xl font-semibold">{kpis.certificatesIssued}</p>
        </div>
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs uppercase text-ink-faint">Seats</p>
          <p className="mt-1 text-2xl font-semibold">{formatSeatsSummary(kpis.seatsUsed, kpis.seatsTotal)}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">At-Risk Learners ({atRisk.total})</h2>
            <Link href="/org/roster" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.top.map((learner) => (
                  <tr key={learner.userId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{learner.name}</td>
                    <td className="px-4 py-2 text-ink-dim">{learner.reasons.map(formatAtRiskReasonLabel).join(", ")}</td>
                  </tr>
                ))}
                {atRisk.top.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-ink-faint">
                      No at-risk learners right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Weakest Modules</h2>
            <Link href="/org/analytics" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
                <tr>
                  <th className="px-4 py-2">Module</th>
                  <th className="px-4 py-2">Attempts</th>
                  <th className="px-4 py-2">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {weakestModules.map((m) => (
                  <tr key={m.moduleId} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{m.title}</td>
                    <td className="px-4 py-2 text-ink-dim">{m.attemptCount}</td>
                    <td className={`px-4 py-2 ${m.averageScore < 70 ? "text-warning-soft-ink" : "text-ink-dim"}`}>
                      {m.averageScore}%
                    </td>
                  </tr>
                ))}
                {weakestModules.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-faint">
                      No quiz attempts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {onboarding.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Onboarding Completion</h2>
            <Link href="/org/onboarding" className="text-xs font-medium text-accent">
              View all &rarr;
            </Link>
          </div>
          <div className="mt-2 space-y-3">
            {onboarding.map((plan) => (
              <div key={plan.planId} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="text-ink-dim">
                    {plan.completedCount} / {plan.assignedCount} complete
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${plan.percentComplete}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
