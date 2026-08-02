"use client";

import { useActionState } from "react";
import { updateCaseDetails, type FormState } from "./actions";

export type CaseDetails = {
  id: string;
  title: string;
  level: string;
  description: string | null;
  slide_id: string | null;
  case_context: string | null;
  lab_values: string | null;
  final_diagnosis: string | null;
  learning_points: string | null;
  estimated_time_minutes: number | null;
  cpd_points: number;
};

export function DetailsForm({
  case_,
  slides,
}: {
  case_: CaseDetails;
  slides: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateCaseDetails,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <input type="hidden" name="id" value={case_.id} />
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-64 flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-title">Title</label>
          <input
            id="case-title"
            name="title"
            required
            defaultValue={case_.title}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-level">Level</label>
          <select
            id="case-level"
            name="level"
            defaultValue={case_.level}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-slide">
            WSI slide (embeds the viewer for learners)
          </label>
          <select
            id="case-slide"
            name="slide_id"
            defaultValue={case_.slide_id ?? ""}
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">No slide</option>
            {slides.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-time">Estimated time (minutes)</label>
          <input
            id="case-time"
            name="estimated_time_minutes"
            type="number"
            min={1}
            defaultValue={case_.estimated_time_minutes ?? ""}
            className="w-40 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-cpd">CPD points</label>
          <input
            id="case-cpd"
            name="cpd_points"
            type="number"
            min={0}
            defaultValue={case_.cpd_points}
            className="w-32 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-description">Summary (optional, grounds the AI Tutor)</label>
        <textarea
          id="case-description"
          name="description"
          rows={2}
          defaultValue={case_.description ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-context">Case context (presenting complaint, history)</label>
        <textarea
          id="case-context"
          name="case_context"
          rows={3}
          defaultValue={case_.case_context ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-lab-values">FBC / other lab values</label>
        <textarea
          id="case-lab-values"
          name="lab_values"
          rows={3}
          defaultValue={case_.lab_values ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-diagnosis">Final diagnosis</label>
        <input
          id="case-diagnosis"
          name="final_diagnosis"
          defaultValue={case_.final_diagnosis ?? ""}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-learning-points">Key learning points</label>
        <textarea
          id="case-learning-points"
          name="learning_points"
          rows={3}
          defaultValue={case_.learning_points ?? ""}
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
