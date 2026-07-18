"use client";

import { useActionState } from "react";
import { addQuestion, type FormState } from "./actions";

export function QuestionForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addQuestion,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="case_id" value={caseId} />
      <input
        name="question_text"
        required
        placeholder="Question text"
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      />
      {(["a", "b", "c", "d"] as const).map((id) => (
        <div key={id} className="flex items-center gap-2">
          <input type="radio" name="correct" value={id} required className="shrink-0" />
          <input
            name={`choice_${id}`}
            placeholder={`Choice ${id.toUpperCase()}${id === "a" || id === "b" ? " (required)" : " (optional)"}`}
            required={id === "a" || id === "b"}
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      ))}
      <p className="text-xs text-neutral-400">Select the radio button next to the correct choice.</p>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add question"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
