"use client";

import { QuizTaker, type QuizQuestion } from "@/components/quiz-taker";
import { submitQuizAttempt } from "./actions";

export function QuizForm({ caseId, questions }: { caseId: string; questions: QuizQuestion[] }) {
  return (
    <QuizTaker idFieldName="case_id" idValue={caseId} questions={questions} action={submitQuizAttempt} />
  );
}
