"use client";

import { useActionState } from "react";
import { createCurriculum, type FormState } from "./actions";

export function CurriculumForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCurriculum,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="curriculum-title">Title</label>
        <input
          id="curriculum-title"
          name="title"
          required
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="curriculum-level">Level</label>
        <select
          id="curriculum-level"
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
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="curriculum-pass-threshold">Pass threshold (%)</label>
        <input
          id="curriculum-pass-threshold"
          name="pass_threshold"
          type="number"
          min={1}
          max={100}
          defaultValue={70}
          className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft curriculum"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
