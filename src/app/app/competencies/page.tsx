import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";

const PROFICIENT_THRESHOLD = 70;

type Status = "Proficient" | "Developing" | "Not yet assessed";
type Lineage = "red_cell" | "white_cell" | "platelet";

function statusFromScores(scores: number[]): Status {
  if (scores.length === 0) return "Not yet assessed";
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return avg >= PROFICIENT_THRESHOLD ? "Proficient" : "Developing";
}

/**
 * Competency areas that already have a real signal to compute from are
 * scored below. "Abnormal cell recognition" has no dedicated content
 * taxonomy or assessment yet, so it stays "Not yet assessed" rather than
 * being backed by a fabricated proxy — revisit once there's a real signal
 * (e.g. a scored pinned WSI identification exercise) to compute it from.
 */
export default async function CompetenciesPage() {
  const supabase = await createClient();
  const userId = await getEffectiveUserId();
  const orgId = await getLearnerOrgId();

  const cases = await getPublishedContent("cases", "case", orgId);
  const caseIds = cases.map((c) => c.id);

  const [{ data: caseFeatureLinks }, { data: attempts }, { data: wbcAttempts }, { data: reportSubmissions }] =
    await Promise.all([
      caseIds.length > 0
        ? supabase
            .from("case_features")
            .select("case_id, features(cell_type_id, cell_types(lineage))")
            .in("case_id", caseIds)
        : Promise.resolve({ data: [] as { case_id: string; features: { cell_type_id: string | null; cell_types: { lineage: string } | null } | null }[] }),
      caseIds.length > 0
        ? supabase.from("quiz_attempts").select("case_id, score").eq("user_id", userId!).in("case_id", caseIds)
        : Promise.resolve({ data: [] as { case_id: string | null; score: number }[] }),
      supabase.from("wbc_diff_attempts").select("exercise_id, accuracy_pct").eq("user_id", userId!),
      supabase.from("case_report_submissions").select("case_id, ai_score").eq("user_id", userId!),
    ]);

  const bestByCase = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.case_id) continue;
    bestByCase.set(a.case_id, Math.max(bestByCase.get(a.case_id) ?? 0, a.score));
  }

  const caseIdsByLineage: Record<Lineage, Set<string>> = {
    red_cell: new Set(),
    white_cell: new Set(),
    platelet: new Set(),
  };
  for (const link of caseFeatureLinks ?? []) {
    const lineage = link.features?.cell_types?.lineage;
    if (lineage === "red_cell" || lineage === "white_cell" || lineage === "platelet") {
      caseIdsByLineage[lineage].add(link.case_id);
    }
  }

  function scoresForLineage(lineage: Lineage): number[] {
    return Array.from(caseIdsByLineage[lineage])
      .map((id) => bestByCase.get(id))
      .filter((s): s is number => s !== undefined);
  }

  const bestByExercise = new Map<string, number>();
  for (const a of wbcAttempts ?? []) {
    bestByExercise.set(a.exercise_id, Math.max(bestByExercise.get(a.exercise_id) ?? 0, Number(a.accuracy_pct)));
  }
  const manualDiffScores = Array.from(bestByExercise.values());

  const bestReportScoreByCase = new Map<string, number>();
  for (const s of reportSubmissions ?? []) {
    bestReportScoreByCase.set(s.case_id, Math.max(bestReportScoreByCase.get(s.case_id) ?? 0, s.ai_score));
  }
  const reportScores = Array.from(bestReportScoreByCase.values());

  const rows: { area: string; status: Status }[] = [
    { area: "RBC morphology", status: statusFromScores(scoresForLineage("red_cell")) },
    { area: "WBC morphology", status: statusFromScores(scoresForLineage("white_cell")) },
    { area: "Platelet morphology", status: statusFromScores(scoresForLineage("platelet")) },
    { area: "Abnormal cell recognition", status: "Not yet assessed" },
    { area: "Manual differential", status: statusFromScores(manualDiffScores) },
    { area: "Morphology reporting", status: statusFromScores(reportScores) },
  ];

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

function StatusPill({ status }: { status: Status }) {
  const styles =
    status === "Proficient"
      ? "bg-success-soft text-success-soft-ink"
      : status === "Developing"
        ? "bg-warning-soft text-warning-soft-ink"
        : "bg-surface-sunken text-ink-dim";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}
