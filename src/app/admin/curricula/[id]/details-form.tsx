"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SummaryField } from "@/components/admin/summary-field";
import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import type { FormState } from "./actions";

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

type PathwayFormValues = Partial<PathwayDetails> & { id?: string };

const BLANK_PATHWAY: PathwayFormValues = { pass_threshold: 70, version: 1 };

/**
 * Shared by the "New pathway" page and the detail page's edit page — same
 * fields either way, just a different action (create vs. update) and
 * whether `pathway` carries existing values.
 */
export function DetailsForm({
  pathway = BLANK_PATHWAY,
  action,
  cancelHref,
}: {
  pathway?: PathwayFormValues;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      {pathway.id && <input type="hidden" name="id" value={pathway.id} />}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-title">Pathway title</label>
          <input
            id="pathway-title"
            name="title"
            required
            defaultValue={pathway.title ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="pathway-level">Competency level</label>
          <select
            id="pathway-level"
            name="level"
            required
            defaultValue={pathway.level ?? ""}
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
            defaultValue={pathway.pass_threshold ?? 70}
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
            defaultValue={pathway.cpd_points ?? 0}
            className="w-44 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-dim">Version</span>
          <p className="px-2 py-1.5 text-sm text-ink-dim">v{pathway.version ?? 1} (automatic)</p>
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
            defaultChecked={pathway.certificate_awarded ?? false}
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

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {cancelHref && (
          <Link
            href={cancelHref}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Cancel
          </Link>
        )}
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function DetailsSummary({ pathway }: { pathway: PathwayDetails & { status: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{pathway.title}</h2>
          <StatusBadge status={pathway.status} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(pathway.status === "draft" || pathway.status === "changes_requested") && (
            <SubmitForReviewButton
              contentType="curriculum"
              id={pathway.id}
              path={`/admin/curricula/${pathway.id}`}
            />
          )}
          <Link
            href={`/admin/curricula/${pathway.id}/edit`}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Edit details
          </Link>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryField label="Competency level" value={<span className="capitalize">{pathway.level}</span>} />
        <SummaryField
          label="Pathway type"
          value={pathway.pathway_type ? PATHWAY_TYPE_LABEL[pathway.pathway_type] : null}
        />
        <SummaryField label="Pass threshold" value={`${pathway.pass_threshold}%`} />
        <SummaryField
          label="Estimated completion"
          value={pathway.estimated_completion_minutes ? `${pathway.estimated_completion_minutes} min` : null}
        />
        <SummaryField label="CPD points" value={pathway.cpd_points} />
        <SummaryField
          label="Certificate"
          value={pathway.certificate_awarded ? pathway.certificate_title || "Awarded" : "Not awarded"}
        />
      </dl>
      <SummaryField label="Short description" value={pathway.description} multiline />
      <SummaryField label="Learning outcomes" value={pathway.learning_outcomes} multiline />
    </div>
  );
}
