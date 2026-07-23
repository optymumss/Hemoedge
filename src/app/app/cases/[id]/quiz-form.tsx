"use client";

import { useActionState, useState } from "react";
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
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = questions.length;
  const question = questions[current];
  const isLast = current === total - 1;
  const isAnswered = Boolean(answers[question.id]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="case_id" value={caseId} />

      <div>
        <div className="flex items-center justify-between text-xs text-ink-dim">
          <span>
            Question {current + 1} of {total}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {questions.map((q, i) =>
        i === current ? (
          <fieldset key={q.id} className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-medium">{q.question_text}</legend>
            <div className="mt-2 flex flex-col gap-1">
              {q.choices.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={c.id}
                    checked={answers[q.id] === c.id}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                  />
                  {c.text}
                </label>
              ))}
            </div>
          </fieldset>
        ) : answers[q.id] ? (
          <input key={q.id} type="hidden" name={`q_${q.id}`} value={answers[q.id]} />
        ) : null,
      )}

      <div className="flex items-center gap-2">
        {current > 0 && (
          <button
            type="button"
            onClick={() => setCurrent((c) => c - 1)}
            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface-sunken"
          >
            Previous
          </button>
        )}
        <div className="flex-1" />
        {!isLast && (
          <button
            type="button"
            onClick={() => setCurrent((c) => c + 1)}
            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-dim hover:bg-surface-sunken"
          >
            Skip
          </button>
        )}
        {isLast ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit answers"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!isAnswered}
            onClick={() => setCurrent((c) => c + 1)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
