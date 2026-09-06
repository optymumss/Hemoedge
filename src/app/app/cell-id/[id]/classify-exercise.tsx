"use client";

import { useEffect, useMemo, useState } from "react";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { recordSlideView } from "@/lib/slides/record-slide-view";
import { submitAttempt } from "./actions";

type Pin = { id: string; x_pct: number; y_pct: number; tolerance_pct: number };
type CellType = { id: string; name: string; lineage: string };

const LINEAGE_LABEL: Record<string, string> = {
  red_cell: "Red cell",
  white_cell: "White cell",
  platelet: "Platelet",
};

function nearestPin(pins: Pin[], xPct: number, yPct: number): Pin | null {
  let best: Pin | null = null;
  let bestDist = Infinity;
  for (const p of pins) {
    const dist = Math.hypot(p.x_pct - xPct, p.y_pct - yPct);
    if (dist <= p.tolerance_pct && dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

export function ClassifyExercise({
  exerciseId,
  slideId,
  pins,
  cellTypes,
}: {
  exerciseId: string;
  slideId: string;
  pins: Pin[];
  cellTypes: CellType[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [dziUrl, setDziUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activePinId, setActivePinId] = useState<string | null>(null);
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
      if (r.dziUrl) setDziUrl(r.dziUrl);
    });
    recordSlideView(slideId);
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  const cellTypesByLineage = useMemo(() => {
    const map = new Map<string, CellType[]>();
    for (const c of cellTypes) {
      const bucket = map.get(c.lineage) ?? [];
      bucket.push(c);
      map.set(c.lineage, bucket);
    }
    return map;
  }, [cellTypes]);

  const allAnswered = pins.length > 0 && pins.every((p) => answers[p.id]);

  const viewerHotspots: WsiHotspot[] = useMemo(
    () =>
      pins.map((p) => ({
        id: p.id,
        xPct: p.x_pct,
        yPct: p.y_pct,
        tone: result
          ? result.correctness[p.id]
            ? "correct"
            : "incorrect"
          : answers[p.id]
            ? "answered"
            : "neutral",
      })),
    [pins, answers, result],
  );

  function handleImageClick(xPct: number, yPct: number) {
    if (result) return;
    const match = nearestPin(pins, xPct, yPct);
    if (!match) return;
    setActivePinId(match.id);
    setCellTypeId(answers[match.id] ?? "");
  }

  function confirmClassification() {
    if (!activePinId || !cellTypeId) return;
    setAnswers((prev) => ({ ...prev, [activePinId]: cellTypeId }));
    setActivePinId(null);
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
        Click each highlighted cell and identify it. {Object.keys(answers).length}/{pins.length} identified.
      </p>
      <div className="h-[32rem] rounded-md bg-black">
        <WsiViewer
          imageUrl={url}
          dziUrl={dziUrl}
          hotspots={viewerHotspots}
          onImageClick={handleImageClick}
        />
      </div>

      {activePinId && !result && (
        <div className="flex items-center gap-2 rounded-md border border-line-strong p-3">
          <span className="text-sm text-ink-dim">Identify this cell:</span>
          <select
            value={cellTypeId}
            onChange={(e) => setCellTypeId(e.target.value)}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">Choose…</option>
            {Array.from(cellTypesByLineage.entries()).map(([lineage, types]) => (
              <optgroup key={lineage} label={LINEAGE_LABEL[lineage] ?? lineage}>
                {types.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
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
            onClick={() => setActivePinId(null)}
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
          Score: {result.accuracyPct}% ({Object.values(result.correctness).filter(Boolean).length}/{pins.length} correct)
        </div>
      )}
    </div>
  );
}
