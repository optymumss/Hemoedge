"use client";

import Link from "next/link";
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
        <label className="text-xs text-ink-dim" htmlFor="cell-id-title">Title</label>
        <input
          id="cell-id-title"
          name="title"
          required
          defaultValue={exercise.title}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="cell-id-level">Level</label>
          <select
            id="cell-id-level"
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
          <label className="text-xs text-ink-dim" htmlFor="cell-id-slide">Slide</label>
          <select
            id="cell-id-slide"
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
          <label className="text-xs text-ink-dim" htmlFor="cell-id-cpd">CPD points</label>
          <input
            id="cell-id-cpd"
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
          <label className="text-xs text-ink-dim" htmlFor="cell-id-module">
            Attach to a module (optional)
          </label>
          <select
            id="cell-id-module"
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
          <label className="text-xs text-ink-dim" htmlFor="cell-id-case">
            Attach to a case study (optional)
          </label>
          <select
            id="cell-id-case"
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
        <label className="text-xs text-ink-dim" htmlFor="cell-id-instructions">
          Instructions for learners (optional)
        </label>
        <textarea
          id="cell-id-instructions"
          name="instructions"
          rows={3}
          defaultValue={exercise.instructions ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save details"}
        </button>
        <Link
          href="/admin/cell-id"
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
        >
          Cancel
        </Link>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
