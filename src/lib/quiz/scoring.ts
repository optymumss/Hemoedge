import type { QuestionType } from "./types";

type ScorableQuestion = {
  question_type: QuestionType | string;
  correct_choice_id: string | null;
  correct_choice_ids: unknown;
};

/**
 * Scores one submitted answer against its question's answer key. Returns
 * "pending" for short_answer, since free text has no correct/incorrect to
 * compute automatically — it needs a reviewer via the grading queue.
 */
export function scoreAnswer(question: ScorableQuestion, submitted: string): boolean | "pending" {
  switch (question.question_type as QuestionType) {
    case "short_answer":
      return "pending";
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
