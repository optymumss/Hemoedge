"use client";

import { useActionState } from "react";
import { createCase, type FormState } from "./actions";

export function CaseForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCase,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Title</label>
        <input
          name="title"
          required
          placeholder="A 28-year-old Woman with Fatigue and Pallor"
          className="w-80 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Level</label>
        <select
          name="level"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose…
          </option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-neutral-500">Description (optional, grounds the AI Tutor)</label>
        <input
          name="description"
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft case"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
