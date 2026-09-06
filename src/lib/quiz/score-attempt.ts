import { scoreAnswer } from "./scoring";
import { gradeShortAnswers } from "./grade-short-answer";

type QuestionForScoring = {
  id: string;
  question_type: string;
  correct_choice_id: string | null;
  correct_choice_ids: unknown;
  question_text: string;
  model_answer: string | null;
};

export type ComputeAttemptResult =
  | { answers: Record<string, string>; score: number; passed: boolean; aiGrades: Record<string, boolean> | null }
  | { error: string };

/**
 * Scores a submitted attempt against its questions. short_answer questions
 * are graded by AI (gradeShortAnswers) against each question's model
 * answer, in the same request as everything else, so a learner gets a final
 * score and pass/fail immediately — no manual Grading Queue step.
 */
export async function computeAttempt(
  questions: QuestionForScoring[],
  formData: FormData,
  passThreshold = 70,
): Promise<ComputeAttemptResult> {
  const answers: Record<string, string> = {};
  let correctCount = 0;

  const shortAnswerItems: { id: string; questionText: string; modelAnswer: string; submitted: string }[] = [];

  for (const q of questions) {
    const submitted = String(formData.get(`q_${q.id}`) ?? "");
    answers[q.id] = submitted;

    if (q.question_type === "short_answer") {
      shortAnswerItems.push({
        id: q.id,
        questionText: q.question_text,
        modelAnswer: q.model_answer ?? "",
        submitted,
      });
      continue;
    }

    if (scoreAnswer(q, submitted)) correctCount += 1;
  }

  let aiGrades: Record<string, boolean> | null = null;
  if (shortAnswerItems.length > 0) {
    const graded = await gradeShortAnswers(shortAnswerItems);
    if ("error" in graded) return { error: graded.error };
    aiGrades = graded.grades;
    for (const correct of Object.values(graded.grades)) {
      if (correct) correctCount += 1;
    }
  }

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= passThreshold;

  return { answers, score, passed, aiGrades };
}
