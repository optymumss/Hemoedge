"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MediaFields } from "@/components/admin/media-fields";
import { SummaryField } from "@/components/admin/summary-field";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import type { FormState } from "./actions";

export const MODULE_TYPE_LABEL: Record<string, string> = {
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
  audio_path: string | null;
  audio_transcript: string | null;
  video_path: string | null;
};

type ModuleFormValues = Partial<ModuleDetails> & { id?: string };

const BLANK_MODULE: ModuleFormValues = {};

/**
 * Shared by the "New module" page and the Details tab's edit page — same
 * fields either way, just a different action (create vs. update) and
 * whether `module_` carries existing values. Keeps the two forms from
 * drifting out of sync with each other.
 */
export function DetailsForm({
  module_ = BLANK_MODULE,
  action,
}: {
  module_?: ModuleFormValues;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      {module_.id && <input type="hidden" name="id" value={module_.id} />}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-title">Title</label>
          <input
            id="module-title"
            name="title"
            required
            defaultValue={module_.title ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="module-level">Competency level</label>
          <select
            id="module-level"
            name="level"
            required
            defaultValue={module_.level ?? ""}
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
            defaultValue={module_.cpd_points ?? 0}
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
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function DetailsSummary({ module_ }: { module_: ModuleDetails & { status: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{module_.title}</h2>
          <StatusBadge status={module_.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(module_.status === "draft" || module_.status === "changes_requested") && (
            <SubmitForReviewButton
              contentType="module"
              id={module_.id}
              path={`/admin/modules/${module_.id}`}
            />
          )}
          <Link
            href={`/admin/modules/${module_.id}/edit`}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Edit details
          </Link>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryField label="Competency level" value={<span className="capitalize">{module_.level}</span>} />
        <SummaryField
          label="Module type"
          value={module_.module_type ? MODULE_TYPE_LABEL[module_.module_type] : null}
        />
        <SummaryField
          label="Estimated duration"
          value={module_.estimated_duration_minutes ? `${module_.estimated_duration_minutes} min` : null}
        />
        <SummaryField label="CPD points" value={module_.cpd_points} />
      </dl>
      <SummaryField label="Description" value={module_.description} multiline />
      <SummaryField label="Learning objectives" value={module_.learning_objectives} multiline />
      <SummaryField label="Teaching notes" value={module_.teaching_notes} multiline />
    </div>
  );
}

export function ModuleMediaFields({ module_ }: { module_: ModuleDetails }) {
  return (
    <MediaFields
      table="modules"
      id={module_.id}
      audioUrl={module_.audio_path}
      audioTranscript={module_.audio_transcript}
      videoUrl={module_.video_path}
    />
  );
}
