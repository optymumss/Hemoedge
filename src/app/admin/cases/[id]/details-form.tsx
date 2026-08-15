"use client";

import { useActionState } from "react";
import { MediaFields } from "@/components/admin/media-fields";
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
  case_category: string | null;
  escalation_decision: string | null;
  suggested_report_comment: string | null;
  audio_path: string | null;
  audio_transcript: string | null;
  video_path: string | null;
};

const CASE_CATEGORY_SUGGESTIONS = [
  "Anaemia",
  "Leukaemia",
  "Platelet disorder",
  "Normal blood film",
  "Artefact",
];

const ESCALATION_LABEL: Record<string, string> = {
  routine: "Routine",
  senior_review: "Senior review",
  urgent: "Urgent escalation",
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-category">Case category</label>
          <input
            id="case-category"
            name="case_category"
            list="case-category-suggestions"
            placeholder="e.g. Anaemia"
            defaultValue={case_.case_category ?? ""}
            className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <datalist id="case-category-suggestions">
            {CASE_CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="case-escalation">Escalation decision</label>
          <select
            id="case-escalation"
            name="escalation_decision"
            defaultValue={case_.escalation_decision ?? ""}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {Object.entries(ESCALATION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="case-report-comment">
          Suggested report comment (safe morphology wording)
        </label>
        <textarea
          id="case-report-comment"
          name="suggested_report_comment"
          rows={3}
          defaultValue={case_.suggested_report_comment ?? ""}
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

export function CaseMediaFields({ case_ }: { case_: CaseDetails }) {
  return (
    <MediaFields
      table="cases"
      id={case_.id}
      audioUrl={case_.audio_path}
      audioTranscript={case_.audio_transcript}
      videoUrl={case_.video_path}
    />
  );
}
