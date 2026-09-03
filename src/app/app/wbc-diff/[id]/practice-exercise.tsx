"use client";

import { useState } from "react";
import { AnnotatedSlideViewer } from "@/components/annotated-slide-viewer";
import { WBC_CATEGORIES, TARGET_COUNT, emptyCounts, type CategoryCode } from "@/lib/wbc-categories";
import { submitAttempt } from "./actions";

/**
 * A free-tally practice run of the Manual Diff Counter — the same counter
 * used inside a case/module, just standalone. Before submitting, only the
 * running total shows (no per-category breakdown) and Teaching Mode is
 * locked, so the learner counts blind the way they would at a real
 * microscope. Submitting reveals the full breakdown next to the reference
 * differential and unlocks Teaching Mode.
 */
export function PracticeExercise({
  exerciseId,
  slideId,
  referenceDifferential,
}: {
  exerciseId: string;
  slideId: string;
  referenceDifferential: Partial<Record<CategoryCode, number>>;
}) {
  const [counts, setCounts] = useState<Record<CategoryCode, number>>(emptyCounts);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ accuracyPct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = WBC_CATEGORIES.reduce((sum, c) => sum + counts[c.code], 0);
  const canSubmit = total === TARGET_COUNT && !result;

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    const r = await submitAttempt(exerciseId, counts);
    setSubmitting(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setResult(r);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">
        Count out a full 100-cell differential using the Manual Diff Counter, then submit to see
        how you compare against the reference differential.
      </p>

      <AnnotatedSlideViewer
        slideId={slideId}
        teachingLocked={!result}
        wbcCounterDefaultOpen
        wbcCounterProps={{
          hideBreakdown: !result,
          disabled: !!result,
          referenceDifferential: result ? referenceDifferential : undefined,
          onCountsChange: setCounts,
        }}
      />

      {!result && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={!canSubmit || submitting}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {submitting
            ? "Scoring…"
            : total < TARGET_COUNT
              ? `Count ${TARGET_COUNT - total} more to finish`
              : "Finish and score"}
        </button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {result && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            result.accuracyPct >= 70
              ? "bg-success-soft text-success-soft-ink"
              : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          Score: {result.accuracyPct}% — compare your tally against the reference differential
          above, and check Teaching Mode for labels.
        </div>
      )}
    </div>
  );
}
