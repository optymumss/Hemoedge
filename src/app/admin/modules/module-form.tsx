"use client";

import { useActionState } from "react";
import { createModule, type FormState } from "./actions";

export function ModuleForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createModule,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="module-title">Title</label>
        <input
          id="module-title"
          name="title"
          required
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="module-level">Level</label>
        <select
          id="module-level"
          name="level"
          required
          defaultValue=""
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
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
        <label className="text-xs text-ink-dim" htmlFor="module-description">Description (optional, grounds the AI Tutor)</label>
        <input
          id="module-description"
          name="description"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft module"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
