"use client";

import { useActionState } from "react";
import { updatePathwayDetails, type FormState } from "./actions";

const PATHWAY_TYPE_LABEL: Record<string, string> = {
  full_pathway: "Full pathway",
  cpd_pathway: "CPD pathway",
  specialist_pathway: "Specialist pathway",
  assessment_preparation: "Assessment preparation",
};

export type PathwayDetails = {
  id: string;
  title: string;
  level: string;
  pass_threshold: number;
  description: string | null;
  pathway_type: string | null;
  learning_outcomes: string | null;
  certificate_awarded: boolean;
  certificate_title: string | null;
  cpd_points: number;
  estimated_completion_minutes: number | null;
  version: number;
};

export function DetailsForm({ pathway }: { pathway: PathwayDetails }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updatePathwayDetails,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <input type="hidden" name="id" value={pathway.id} />
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-title">Pathway title</label>
          <input
            id="pathway-title"
            name="title"
            required
            defaultValue={pathway.title}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-level">Competency level</label>
          <select
            id="pathway-level"
            name="level"
            defaultValue={pathway.level}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-type">Pathway type</label>
          <select
            id="pathway-type"
            name="pathway_type"
            defaultValue={pathway.pathway_type ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {Object.entries(PATHWAY_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-pass-threshold">Pass threshold (%)</label>
          <input
            id="pathway-pass-threshold"
            name="pass_threshold"
            type="number"
            min={1}
            max={100}
            defaultValue={pathway.pass_threshold}
            className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-duration">Estimated completion (minutes)</label>
          <input
            id="pathway-duration"
            name="estimated_completion_minutes"
            type="number"
            min={1}
            defaultValue={pathway.estimated_completion_minutes ?? ""}
            className="w-44 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-cpd">Pathway completion CPD points</label>
          <input
            id="pathway-cpd"
            name="cpd_points"
            type="number"
            min={0}
            defaultValue={pathway.cpd_points}
            className="w-44 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-dim">Version</span>
          <p className="px-2 py-1.5 text-sm text-ink-dim">v{pathway.version} (automatic)</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="pathway-description">Short description</label>
        <textarea
          id="pathway-description"
          name="description"
          rows={2}
          defaultValue={pathway.description ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="pathway-learning-outcomes">Learning outcomes</label>
        <textarea
          id="pathway-learning-outcomes"
          name="learning_outcomes"
          rows={3}
          defaultValue={pathway.learning_outcomes ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="certificate_awarded"
            defaultChecked={pathway.certificate_awarded}
            className="accent-accent"
          />
          Certificate awarded on completion
        </label>
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-certificate-title">Certificate title (if awarded)</label>
          <input
            id="pathway-certificate-title"
            name="certificate_title"
            defaultValue={pathway.certificate_title ?? ""}
            placeholder="Learner-facing certificate name"
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
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
