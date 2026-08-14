import { QUESTION_TYPES, type QuestionType } from "./types";

export type ParsedQuestion = {
  question_text: string;
  question_type: QuestionType;
  choices: { id: string; text: string }[];
  correct_choice_id: string | null;
  correct_choice_ids: string[] | null;
  feature_id: string | null;
  model_answer: string | null;
};

const CHOICE_IDS = ["a", "b", "c", "d"];

/** Shared authoring-form parsing/validation for both case and module quiz questions. */
export function parseQuestionForm(formData: FormData): ParsedQuestion | { error: string } {
  const questionText = String(formData.get("question_text") ?? "").trim();
  const questionTypeRaw = String(formData.get("question_type") ?? "single_choice");
  const modelAnswer = String(formData.get("model_answer") ?? "").trim() || null;
  const featureId = String(formData.get("feature_id") ?? "").trim() || null;

  const questionType = (
    QUESTION_TYPES.includes(questionTypeRaw as QuestionType) ? questionTypeRaw : "single_choice"
  ) as QuestionType;

  if (!questionText) return { error: "Question text is required." };

  if (questionType === "short_answer") {
    return {
      question_text: questionText,
      question_type: questionType,
      choices: [],
      correct_choice_id: null,
      correct_choice_ids: null,
      feature_id: null,
      model_answer: modelAnswer,
    };
  }

  if (questionType === "image_match" && !featureId) {
    return { error: "Choose an image for an image-match question." };
  }

  const choices = CHOICE_IDS.map((id) => ({
    id,
    text: String(formData.get(`choice_${id}`) ?? "").trim(),
  })).filter((c) => c.text.length > 0);

  if (choices.length < 2) return { error: "Enter at least two choices." };

  const correctIds = formData.getAll("correct").map(String);
  if (correctIds.length === 0) return { error: "Check at least one correct choice." };
  if (correctIds.some((id) => !choices.some((c) => c.id === id))) {
    return { error: "A checked choice has no text." };
  }

  if (questionType === "multi_select") {
    return {
      question_text: questionText,
      question_type: questionType,
      choices,
      correct_choice_id: null,
      correct_choice_ids: correctIds,
      feature_id: null,
      model_answer: modelAnswer,
    };
  }

  if (correctIds.length !== 1) {
    return { error: "Check exactly one correct choice for this question type." };
  }

  return {
    question_text: questionText,
    question_type: questionType,
    choices,
    correct_choice_id: correctIds[0],
    correct_choice_ids: null,
    feature_id: questionType === "image_match" ? featureId : null,
    model_answer: modelAnswer,
  };
}
