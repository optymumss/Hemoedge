"use client";

import { useActionState } from "react";
import { addQuestion, type FormState } from "./actions";
import { QuestionEditorFields, type FeatureOption } from "@/components/admin/question-editor-fields";

export function QuestionForm({ caseId, features }: { caseId: string; features: FeatureOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addQuestion,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="case_id" value={caseId} />
      <QuestionEditorFields features={features} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add question"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
