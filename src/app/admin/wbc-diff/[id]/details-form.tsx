"use client";

import { useActionState } from "react";
import { updateExerciseDetails, type FormState } from "./actions";

type Exercise = {
  id: string;
  title: string;
  level: string;
  slide_id: string;
  module_id: string | null;
  case_id: string | null;
  instructions: string | null;
  cpd_points: number;
};

export function DetailsForm({
  exercise,
  slides,
  modules,
  cases,
}: {
  exercise: Exercise;
  slides: { id: string; title: string }[];
  modules: { id: string; title: string }[];
  cases: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateExerciseDetails,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={exercise.id} />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="wbc-title">Title</label>
        <input
          id="wbc-title"
          name="title"
          required
          defaultValue={exercise.title}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="wbc-level">Level</label>
          <select
            id="wbc-level"
            name="level"
            required
            defaultValue={exercise.level}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="wbc-slide">Slide</label>
          <select
            id="wbc-slide"
            name="slide_id"
            required
            defaultValue={exercise.slide_id}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            {slides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="wbc-cpd">CPD points</label>
          <input
            id="wbc-cpd"
            name="cpd_points"
            type="number"
            min={0}
            step={1}
            defaultValue={exercise.cpd_points}
            className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="wbc-module">
            Attach to a module (optional)
          </label>
          <select
            id="wbc-module"
            name="module_id"
            defaultValue={exercise.module_id ?? ""}
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">Standalone practice (no module)</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="wbc-case">
            Attach to a case study (optional)
          </label>
          <select
            id="wbc-case"
            name="case_id"
            defaultValue={exercise.case_id ?? ""}
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">Standalone practice (no case study)</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="wbc-instructions">
          Instructions for learners (optional)
        </label>
        <textarea
          id="wbc-instructions"
          name="instructions"
          rows={3}
          defaultValue={exercise.instructions ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save details"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
