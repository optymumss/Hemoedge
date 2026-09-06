"use client";

import { useActionState } from "react";
import { createExercise, type FormState } from "./actions";

export function ExerciseForm({
  slides,
}: {
  slides: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createExercise,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input
        name="title"
        required
        placeholder="Exercise title"
        className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <select
          name="level"
          required
          defaultValue=""
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Level…
          </option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <select
          name="slide_id"
          required
          defaultValue=""
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose a slide…
          </option>
          {slides.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft exercise"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
