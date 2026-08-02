"use client";

import { useActionState } from "react";
import { updateModuleDetails, type FormState } from "./actions";

const MODULE_TYPE_LABEL: Record<string, string> = {
  foundation: "Foundation",
  fbc: "FBC",
  morphology: "Morphology",
  case_based: "Case-based",
  practical: "Practical",
  assessment: "Assessment",
};

export type ModuleDetails = {
  id: string;
  title: string;
  level: string;
  description: string | null;
  module_type: string | null;
  learning_objectives: string | null;
  teaching_notes: string | null;
  estimated_duration_minutes: number | null;
  cpd_points: number;
};

export function DetailsForm({ module_ }: { module_: ModuleDetails }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateModuleDetails,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <input type="hidden" name="id" value={module_.id} />
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-title">Title</label>
          <input
            id="module-title"
            name="title"
            required
            defaultValue={module_.title}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-level">Competency level</label>
          <select
            id="module-level"
            name="level"
            defaultValue={module_.level}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-type">Module type</label>
          <select
            id="module-type"
            name="module_type"
            defaultValue={module_.module_type ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {Object.entries(MODULE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-duration">Estimated duration (minutes)</label>
          <input
            id="module-duration"
            name="estimated_duration_minutes"
            type="number"
            min={1}
            defaultValue={module_.estimated_duration_minutes ?? ""}
            className="w-40 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-cpd">CPD points</label>
          <input
            id="module-cpd"
            name="cpd_points"
            type="number"
            min={0}
            defaultValue={module_.cpd_points}
            className="w-32 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="module-description">Description</label>
        <textarea
          id="module-description"
          name="description"
          rows={2}
          defaultValue={module_.description ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="module-learning-objectives">Learning objectives</label>
        <textarea
          id="module-learning-objectives"
          name="learning_objectives"
          rows={3}
          defaultValue={module_.learning_objectives ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="module-teaching-notes">Teaching notes</label>
        <textarea
          id="module-teaching-notes"
          name="teaching_notes"
          rows={3}
          defaultValue={module_.teaching_notes ?? ""}
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
