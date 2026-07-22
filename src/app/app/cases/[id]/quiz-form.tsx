"use client";

import { useActionState } from "react";
import { submitQuizAttempt, type FormState } from "./actions";

type Question = {
  id: string;
  question_text: string;
  choices: { id: string; text: string }[];
};

export function QuizForm({
  caseId,
  questions,
}: {
  caseId: string;
  questions: Question[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitQuizAttempt,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="case_id" value={caseId} />
      {questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-medium">
            {i + 1}. {q.question_text}
          </legend>
          <div className="mt-2 flex flex-col gap-1">
            {q.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name={`q_${q.id}`} value={c.id} required />
                {c.text}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit answers"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
