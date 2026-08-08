"use client";

import { useEffect, useMemo, useState } from "react";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { submitAttempt } from "./actions";

type Hotspot = { id: string; x_pct: number; y_pct: number; tolerance_pct: number };

function nearestHotspot(hotspots: Hotspot[], xPct: number, yPct: number): Hotspot | null {
  let best: Hotspot | null = null;
  let bestDist = Infinity;
  for (const h of hotspots) {
    const dist = Math.hypot(h.x_pct - xPct, h.y_pct - yPct);
    if (dist <= h.tolerance_pct && dist < bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best;
}

export function ClassifyExercise({
  exerciseId,
  slideId,
  hotspots,
  cellTypes,
}: {
  exerciseId: string;
  slideId: string;
  hotspots: Hotspot[];
  cellTypes: { id: string; name: string }[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [cellTypeId, setCellTypeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ accuracyPct: number; correctness: Record<string, boolean> } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSlideViewUrl(slideId).then((r) => {
      if (cancelled) return;
      if (r.error) setLoadError(r.error);
      else if (r.url) setUrl(r.url);
    });
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  const allAnswered = hotspots.length > 0 && hotspots.every((h) => answers[h.id]);

  const viewerHotspots: WsiHotspot[] = useMemo(
    () =>
      hotspots.map((h) => ({
        id: h.id,
        xPct: h.x_pct,
        yPct: h.y_pct,
        tone: result
          ? result.correctness[h.id]
            ? "correct"
            : "incorrect"
          : answers[h.id]
            ? "answered"
            : "neutral",
      })),
    [hotspots, answers, result],
  );

  function handleImageClick(xPct: number, yPct: number) {
    if (result) return;
    const match = nearestHotspot(hotspots, xPct, yPct);
    if (!match) return;
    setActiveHotspotId(match.id);
    setCellTypeId(answers[match.id] ?? "");
  }

  function confirmClassification() {
    if (!activeHotspotId || !cellTypeId) return;
    setAnswers((prev) => ({ ...prev, [activeHotspotId]: cellTypeId }));
    setActiveHotspotId(null);
    setCellTypeId("");
  }

  async function handleFinish() {
    setSubmitting(true);
    setSubmitError(null);
    const r = await submitAttempt(exerciseId, answers);
    setSubmitting(false);
    if ("error" in r) {
      setSubmitError(r.error);
      return;
    }
    setResult(r);
  }

  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!url) return <p className="text-sm text-ink-faint">Loading slide…</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">
        Click each highlighted cell and classify it. {Object.keys(answers).length}/{hotspots.length} classified.
      </p>
      <div className="h-[32rem] rounded-md bg-black">
        <WsiViewer imageUrl={url} hotspots={viewerHotspots} onImageClick={handleImageClick} />
      </div>

      {activeHotspotId && !result && (
        <div className="flex items-center gap-2 rounded-md border border-line-strong p-3">
          <span className="text-sm text-ink-dim">Classify this cell:</span>
          <select
            value={cellTypeId}
            onChange={(e) => setCellTypeId(e.target.value)}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">Choose…</option>
            {cellTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={confirmClassification}
            disabled={!cellTypeId}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setActiveHotspotId(null)}
            className="text-sm text-ink-dim underline"
          >
            Cancel
          </button>
        </div>
      )}

      {!result && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={!allAnswered || submitting}
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {submitting ? "Scoring…" : "Finish and score"}
        </button>
      )}
      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      {result && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            result.accuracyPct >= 70 ? "bg-success-soft text-success-soft-ink" : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          Score: {result.accuracyPct}% ({Object.values(result.correctness).filter(Boolean).length}/{hotspots.length} correct)
        </div>
      )}
    </div>
  );
}
