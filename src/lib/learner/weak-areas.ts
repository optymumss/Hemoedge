import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, type CategoryCode } from "@/lib/wbc-categories";

export type WeakArea = { label: string; accuracyPct: number; attempts: number };

const MIN_ATTEMPTS = 2;
const WEAK_THRESHOLD_PCT = 70;
const MAX_RESULTS = 5;
/** A learner's per-category tally within this many points of the exercise's
 * reference differential counts as "correct" for weak-area purposes. */
const CATEGORY_TOLERANCE = 5;

/**
 * Aggregates a learner's wrong answers into weak feature/category areas —
 * quiz questions tagged with a feature (feature_id is optional; only tagged
 * questions can contribute here) and Manual Diff Counter practice attempts
 * (each category's tally compared against that exercise's reference
 * differential). Areas with fewer than MIN_ATTEMPTS are dropped so one
 * lucky/unlucky guess doesn't show up as a strength or weakness.
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
    .select("results, wbc_diff_exercises(reference_differential)")
    .eq("user_id", userId);

  for (const attempt of diffAttempts ?? []) {
    const results = (attempt.results as Partial<Record<CategoryCode, number>>) ?? {};
    const reference = (attempt.wbc_diff_exercises?.reference_differential as Partial<
      Record<CategoryCode, number>
    >) ?? null;
    if (!reference) continue;

    for (const [code, learnerValue] of Object.entries(results) as [CategoryCode, number][]) {
      const referenceValue = reference[code];
      if (referenceValue === undefined) continue;
      const label = CATEGORY_LABEL[code];
      const bucket = tally.get(label) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (Math.abs(learnerValue - referenceValue) <= CATEGORY_TOLERANCE) bucket.correct += 1;
      tally.set(label, bucket);
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
