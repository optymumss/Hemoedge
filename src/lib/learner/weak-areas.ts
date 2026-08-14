import { createClient } from "@/lib/supabase/server";

export type WeakArea = { label: string; accuracyPct: number; attempts: number };

const MIN_ATTEMPTS = 2;
const WEAK_THRESHOLD_PCT = 70;
const MAX_RESULTS = 5;

/**
 * Aggregates a learner's wrong answers into weak feature/cell-type areas —
 * quiz questions tagged with a feature (feature_id is optional; only tagged
 * questions can contribute here) and WBC diff hotspot attempts (already
 * tagged with a cell type by nature of the exercise). Areas with fewer than
 * MIN_ATTEMPTS are dropped so one lucky/unlucky guess doesn't show up as a
 * strength or weakness.
 */
export async function getWeakAreas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<WeakArea[]> {
  const tally = new Map<string, { correct: number; total: number }>();

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("answers")
    .eq("user_id", userId);

  const questionIds = new Set<string>();
  for (const attempt of attempts ?? []) {
    for (const qid of Object.keys((attempt.answers as Record<string, string>) ?? {})) {
      questionIds.add(qid);
    }
  }

  if (questionIds.size > 0) {
    const { data: questions } = await supabase
      .from("quiz_questions")
      .select("id, correct_choice_id, features(title)")
      .in("id", Array.from(questionIds))
      .not("feature_id", "is", null);

    const questionById = new Map((questions ?? []).map((q) => [q.id, q]));
    for (const attempt of attempts ?? []) {
      const answers = (attempt.answers as Record<string, string>) ?? {};
      for (const [qid, chosen] of Object.entries(answers)) {
        const question = questionById.get(qid);
        const label = question?.features?.title;
        if (!question || !label) continue;
        const bucket = tally.get(label) ?? { correct: 0, total: 0 };
        bucket.total += 1;
        if (chosen === question.correct_choice_id) bucket.correct += 1;
        tally.set(label, bucket);
      }
    }
  }

  const { data: diffAttempts } = await supabase
    .from("wbc_diff_attempts")
    .select("results")
    .eq("user_id", userId);

  const cellTypeTotals = new Map<string, { correct: number; total: number }>();
  for (const attempt of diffAttempts ?? []) {
    const results = (attempt.results as Record<string, { correct: number; total: number }>) ?? {};
    for (const [cellTypeId, r] of Object.entries(results)) {
      const bucket = cellTypeTotals.get(cellTypeId) ?? { correct: 0, total: 0 };
      bucket.correct += r.correct;
      bucket.total += r.total;
      cellTypeTotals.set(cellTypeId, bucket);
    }
  }

  if (cellTypeTotals.size > 0) {
    const { data: cellTypes } = await supabase
      .from("cell_types")
      .select("id, name")
      .in("id", Array.from(cellTypeTotals.keys()));

    for (const ct of cellTypes ?? []) {
      const bucket = cellTypeTotals.get(ct.id);
      if (!bucket) continue;
      const existing = tally.get(ct.name) ?? { correct: 0, total: 0 };
      tally.set(ct.name, {
        correct: existing.correct + bucket.correct,
        total: existing.total + bucket.total,
      });
    }
  }

  return Array.from(tally.entries())
    .map(([label, { correct, total }]) => ({
      label,
      accuracyPct: Math.round((correct / total) * 100),
      attempts: total,
    }))
    .filter((a) => a.attempts >= MIN_ATTEMPTS && a.accuracyPct < WEAK_THRESHOLD_PCT)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, MAX_RESULTS);
}
