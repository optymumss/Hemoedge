"use client";

import { useState } from "react";
import { submitCaseReport, type SubmitReportResult } from "./actions";

const ESCALATION_LABEL: Record<string, string> = {
  routine: "Routine",
  senior_review: "Senior review",
  urgent: "Urgent escalation",
};

const BLANK_FIELDS = {
  rbcMorphology: "",
  wbcMorphology: "",
  plateletMorphology: "",
  abnormalFindings: "",
  overallInterpretation: "",
  escalationDecision: "",
  reportComment: "",
};

/**
 * The structured report builder: a learner works through the same 7
 * sections a real morphology report would cover, then submits for AI
 * grading against this case's own answer key (not general knowledge —
 * see gradeCaseReport). Separate from the case's multiple-choice quiz
 * further down the page.
 */
export function ReportBuilder({ caseId }: { caseId: string }) {
  const [fields, setFields] = useState(BLANK_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitReportResult | null>(null);

  function update<K extends keyof typeof BLANK_FIELDS>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const r = await submitCaseReport(caseId, fields);
    setSubmitting(false);
    setResult(r);
  }

  function tryAgain() {
    setFields(BLANK_FIELDS);
    setResult(null);
  }

  if (result && !("error" in result)) {
    return (
      <div className="mt-6 max-w-2xl rounded-lg border border-line p-4">
        <h2 className="text-sm font-semibold">Structured report — result</h2>
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            result.score >= 70 ? "bg-success-soft text-success-soft-ink" : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          AI score: {result.score}%
        </div>
        {result.missedFindings.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-ink-dim">Missed findings</p>
            <ul className="mt-1 list-inside list-disc text-sm text-ink-dim">
              {result.missedFindings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-dim">Feedback</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{result.feedback}</p>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-dim">Escalation decision</p>
          <p className={`mt-1 text-sm ${result.escalationCorrect ? "text-success-soft-ink" : "text-warning-soft-ink"}`}>
            You chose {ESCALATION_LABEL[fields.escalationDecision] ?? fields.escalationDecision}
            {result.escalationCorrect ? " — correct." : "."}
          </p>
          {!result.escalationCorrect && result.correctEscalationDecision && (
            <p className="mt-1 text-sm text-ink-dim">
              Correct answer: {ESCALATION_LABEL[result.correctEscalationDecision] ?? result.correctEscalationDecision}
            </p>
          )}
        </div>
        {result.suggestedReportComment && (
          <div className="mt-3">
            <p className="text-xs font-medium text-ink-dim">Expert suggested report comment</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{result.suggestedReportComment}</p>
          </div>
        )}
        <button
          type="button"
          onClick={tryAgain}
          className="mt-4 rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
        >
          Submit another attempt
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl rounded-lg border border-line p-4">
      <h2 className="text-sm font-semibold">Structured report</h2>
      <p className="mt-1 text-sm text-ink-dim">
        Work through the slide and results, then write up your findings as you would in a real
        report. Submit to get AI feedback against this case&apos;s answer key.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-rbc">Red cell morphology</label>
          <textarea
            id="report-rbc"
            rows={2}
            required
            value={fields.rbcMorphology}
            onChange={(e) => update("rbcMorphology", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-wbc">White cell morphology</label>
          <textarea
            id="report-wbc"
            rows={2}
            required
            value={fields.wbcMorphology}
            onChange={(e) => update("wbcMorphology", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-platelet">Platelet morphology</label>
          <textarea
            id="report-platelet"
            rows={2}
            required
            value={fields.plateletMorphology}
            onChange={(e) => update("plateletMorphology", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-abnormal">
            Abnormal cells, parasites, or significant flags
          </label>
          <textarea
            id="report-abnormal"
            rows={2}
            required
            value={fields.abnormalFindings}
            onChange={(e) => update("abnormalFindings", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-interpretation">Overall interpretation</label>
          <textarea
            id="report-interpretation"
            rows={2}
            required
            value={fields.overallInterpretation}
            onChange={(e) => update("overallInterpretation", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-escalation">Escalation decision</label>
          <select
            id="report-escalation"
            required
            value={fields.escalationDecision}
            onChange={(e) => update("escalationDecision", e.target.value)}
            className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              Choose…
            </option>
            {Object.entries(ESCALATION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="report-comment">Suggested report comment</label>
          <textarea
            id="report-comment"
            rows={3}
            required
            value={fields.reportComment}
            onChange={(e) => update("reportComment", e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {submitting ? "Grading…" : "Submit for AI grading"}
      </button>
      {result && "error" in result && <p className="mt-2 text-sm text-danger">{result.error}</p>}
    </form>
  );
}
