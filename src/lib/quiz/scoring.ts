import type { QuestionType } from "./types";

type ScorableQuestion = {
  question_type: QuestionType | string;
  correct_choice_id: string | null;
  correct_choice_ids: unknown;
};

/**
 * Scores one submitted answer against its question's answer key. Never
 * called for short_answer — those are graded separately by AI
 * (gradeShortAnswers), since free text has no choice-based key to compare.
 */
export function scoreAnswer(question: ScorableQuestion, submitted: string): boolean {
  switch (question.question_type as QuestionType) {
    case "multi_select": {
      const correct = new Set(
        Array.isArray(question.correct_choice_ids) ? (question.correct_choice_ids as string[]) : [],
      );
      const chosen = new Set(submitted ? submitted.split(",").filter(Boolean) : []);
      if (correct.size === 0 || correct.size !== chosen.size) return false;
      for (const id of chosen) if (!correct.has(id)) return false;
      return true;
    }
    case "single_choice":
    case "true_false":
    case "image_match":
    default:
      return submitted === question.correct_choice_id;
  }
}
