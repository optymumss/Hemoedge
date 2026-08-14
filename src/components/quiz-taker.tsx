"use client";

import { useActionState, useState } from "react";

export type QuizQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  choices: { id: string; text: string }[];
  imageUrl?: string | null;
};

type FormState = { error?: string } | undefined;

/**
 * Shared quiz-taking form for both case studies and modules — same
 * one-question-per-page flow, extended to handle every question_type.
 * Visible controls are uncontrolled-by-name; a hidden mirror input per
 * answered question carries the actual submitted value, so the same
 * approach works uniformly for radios, checkboxes, and free text.
 */
export function QuizTaker({
  idFieldName,
  idValue,
  questions,
  action,
}: {
  idFieldName: "case_id" | "module_id";
  idValue: string;
  questions: QuizQuestion[];
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<Record<string, Set<string>>>({});

  const total = questions.length;
  const question = questions[current];
  const isLast = current === total - 1;
  const isAnswered = Boolean(answers[question.id]?.trim());

  function setAnswer(qid: string, value: string) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function toggleMulti(qid: string, choiceId: string) {
    setMultiSelected((prev) => {
      const set = new Set(prev[qid] ?? []);
      if (set.has(choiceId)) set.delete(choiceId);
      else set.add(choiceId);
      setAnswer(qid, Array.from(set).join(","));
      return { ...prev, [qid]: set };
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name={idFieldName} value={idValue} />
      {questions.map((q) =>
        answers[q.id] ? <input key={q.id} type="hidden" name={`q_${q.id}`} value={answers[q.id]} /> : null,
      )}

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

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-medium">{question.question_text}</legend>
        {question.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.imageUrl}
            alt=""
            className="mt-2 max-h-64 rounded-md border border-line object-contain"
          />
        )}
        <div className="mt-2 flex flex-col gap-1">
          {question.question_type === "short_answer" ? (
            <textarea
              rows={4}
              value={answers[question.id] ?? ""}
              onChange={(e) => setAnswer(question.id, e.target.value)}
              placeholder="Type your answer…"
              className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
          ) : question.question_type === "multi_select" ? (
            question.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={multiSelected[question.id]?.has(c.id) ?? false}
                  onChange={() => toggleMulti(question.id, c.id)}
                />
                {c.text}
              </label>
            ))
          ) : (
            question.choices.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={answers[question.id] === c.id}
                  onChange={() => setAnswer(question.id, c.id)}
                />
                {c.text}
              </label>
            ))
          )}
        </div>
      </fieldset>

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
