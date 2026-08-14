import { scoreAnswer } from "./scoring";

type QuestionForScoring = {
  id: string;
  question_type: string;
  correct_choice_id: string | null;
  correct_choice_ids: unknown;
};

/**
 * Scores a submitted attempt against its questions. Short-answer questions
 * can't be auto-scored, so while any are present the score reflects only the
 * auto-gradeable questions and passed stays false — pendingManualGrading
 * tells the caller to hold off on a final verdict until a reviewer grades
 * the free-text answers and the attempt is recomputed.
 */
export function computeAttempt(
  questions: QuestionForScoring[],
  formData: FormData,
  passThreshold = 70,
) {
  const answers: Record<string, string> = {};
  let correctCount = 0;
  let autoGradedCount = 0;
  let pendingManualGrading = false;

  for (const q of questions) {
    const submitted = String(formData.get(`q_${q.id}`) ?? "");
    answers[q.id] = submitted;
    const result = scoreAnswer(q, submitted);
    if (result === "pending") {
      pendingManualGrading = true;
      continue;
    }
    autoGradedCount += 1;
    if (result) correctCount += 1;
  }

  const score = autoGradedCount > 0 ? Math.round((correctCount / autoGradedCount) * 100) : 0;
  const passed = !pendingManualGrading && score >= passThreshold;

  return { answers, score, passed, pendingManualGrading };
}
