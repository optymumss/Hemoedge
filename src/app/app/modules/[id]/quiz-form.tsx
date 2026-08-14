"use client";

import { QuizTaker, type QuizQuestion } from "@/components/quiz-taker";
import { submitQuizAttempt } from "./actions";

export function QuizForm({ moduleId, questions }: { moduleId: string; questions: QuizQuestion[] }) {
  return (
    <QuizTaker idFieldName="module_id" idValue={moduleId} questions={questions} action={submitQuizAttempt} />
  );
}
