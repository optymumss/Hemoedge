import { createClient } from "@/lib/supabase/server";
import { getPublishedContent } from "@/lib/learner/published-content";
import type { CompetencyRow } from "./study-recommendation";

export const PROFICIENT_THRESHOLD = 70;

export function statusFromScores(scores: number[]): "Proficient" | "Developing" | "Not yet assessed" {
  if (scores.length === 0) return "Not yet assessed";
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return avg >= PROFICIENT_THRESHOLD ? "Proficient" : "Developing";
}

/**
 * The six Competencies-page rows: best score per exercise/case (not a raw
 * average of every attempt, so retries only ever help), bounded to whatever
 * the learner's org has selected from the catalog (or everything published,
 * for a self-directed learner).
 */
export async function getCompetencyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<CompetencyRow[]> {
  const cases = await getPublishedContent("cases", "case", orgId);
  const caseIds = cases.map((c) => c.id);

  const [{ data: caseFeatureLinks }, { data: attempts }, { data: wbcAttempts }, { data: reportSubmissions }, { data: cellIdAttempts }] =
    await Promise.all([
      caseIds.length > 0
        ? supabase
            .from("case_features")
            .select("case_id, features(cell_type_id, cell_types(lineage))")
            .in("case_id", caseIds)
        : Promise.resolve({ data: [] as { case_id: string; features: { cell_type_id: string | null; cell_types: { lineage: string } | null } | null }[] }),
      caseIds.length > 0
        ? supabase.from("quiz_attempts").select("case_id, score").eq("user_id", userId).in("case_id", caseIds)
        : Promise.resolve({ data: [] as { case_id: string | null; score: number }[] }),
      supabase.from("wbc_diff_attempts").select("exercise_id, accuracy_pct").eq("user_id", userId),
      supabase.from("case_report_submissions").select("case_id, ai_score").eq("user_id", userId),
      supabase.from("cell_id_attempts").select("exercise_id, accuracy_pct").eq("user_id", userId),
    ]);

  const bestByCase = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.case_id) continue;
    bestByCase.set(a.case_id, Math.max(bestByCase.get(a.case_id) ?? 0, a.score));
  }

  const caseIdsByLineage: Record<"red_cell" | "white_cell" | "platelet", Set<string>> = {
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
  function scoresForLineage(lineage: "red_cell" | "white_cell" | "platelet"): number[] {
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

  const bestByCellIdExercise = new Map<string, number>();
  for (const a of cellIdAttempts ?? []) {
    bestByCellIdExercise.set(a.exercise_id, Math.max(bestByCellIdExercise.get(a.exercise_id) ?? 0, Number(a.accuracy_pct)));
  }
  const cellIdScores = Array.from(bestByCellIdExercise.values());

  return [
    { area: "RBC morphology", status: statusFromScores(scoresForLineage("red_cell")) },
    { area: "WBC morphology", status: statusFromScores(scoresForLineage("white_cell")) },
    { area: "Platelet morphology", status: statusFromScores(scoresForLineage("platelet")) },
    { area: "Abnormal cell recognition", status: statusFromScores(cellIdScores) },
    { area: "Manual differential", status: statusFromScores(manualDiffScores) },
    { area: "Morphology reporting", status: statusFromScores(reportScores) },
  ];
}
