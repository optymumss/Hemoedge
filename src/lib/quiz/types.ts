export type QuestionType = "single_choice" | "true_false" | "multi_select" | "image_match" | "short_answer";

export const QUESTION_TYPES: QuestionType[] = [
  "single_choice",
  "true_false",
  "multi_select",
  "image_match",
  "short_answer",
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  single_choice: "Single choice",
  true_false: "True / False",
  multi_select: "Multiple select",
  image_match: "Image match",
  short_answer: "Short answer",
};

export type Choice = { id: string; text: string };
