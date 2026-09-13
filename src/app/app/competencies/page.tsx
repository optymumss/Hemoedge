import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getCompetencyRows } from "@/lib/learner/competency-rows";
import type { CompetencyStatus } from "@/lib/learner/study-recommendation";

export default async function CompetenciesPage() {
  const supabase = await createClient();
  const userId = await getEffectiveUserId();
  const orgId = await getLearnerOrgId();

  const rows = await getCompetencyRows(supabase, userId!, orgId);

  return (
    <div>
      <h1 className="text-xl font-semibold">Competencies</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Your demonstrated skill level across core morphology competency areas, based on your case
        study and manual differential exercise performance.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Competency area</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.area} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.area}</td>
                <td className="px-4 py-2">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CompetencyStatus }) {
  const styles =
    status === "Proficient"
      ? "bg-success-soft text-success-soft-ink"
      : status === "Developing"
        ? "bg-warning-soft text-warning-soft-ink"
        : "bg-surface-sunken text-ink-dim";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}
