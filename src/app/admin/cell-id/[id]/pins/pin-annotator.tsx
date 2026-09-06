"use client";

import { useEffect, useState } from "react";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { addPin, deletePin } from "./actions";

type Pin = {
  id: string;
  x_pct: number;
  y_pct: number;
  cell_type_id: string;
  cell_types: { name: string } | null;
};

type CellType = { id: string; name: string; lineage: string };

const LINEAGE_LABEL: Record<string, string> = {
  red_cell: "Red cell",
  white_cell: "White cell",
  platelet: "Platelet",
};

export function PinAnnotator({
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ xPct: number; yPct: number } | null>(null);
  const [cellTypeId, setCellTypeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSlideViewUrl(slideId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
      if (result.dziUrl) setDziUrl(result.dziUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  const viewerHotspots: WsiHotspot[] = [
    ...pins.map((p) => ({ id: p.id, xPct: p.x_pct, yPct: p.y_pct, tone: "neutral" as const })),
    ...(pending ? [{ id: "pending", xPct: pending.xPct, yPct: pending.yPct, tone: "correct" as const }] : []),
  ];

  const cellTypesByLineage = new Map<string, CellType[]>();
  for (const c of cellTypes) {
    const bucket = cellTypesByLineage.get(c.lineage) ?? [];
    bucket.push(c);
    cellTypesByLineage.set(c.lineage, bucket);
  }

  async function handleAddPin() {
    if (!pending || !cellTypeId) return;
    setSaving(true);
    const result = await addPin(exerciseId, pending.xPct, pending.yPct, cellTypeId);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending(null);
    setCellTypeId("");
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!url) return <p className="text-sm text-ink-faint">Loading slide…</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">
        Click a cell on the slide to drop a pin, then pick its type below. Pins can be any cell
        type — normal or abnormal — this is what learners will be asked to identify.
      </p>
      <div className="h-[32rem] rounded-md bg-black">
        <WsiViewer
          imageUrl={url}
          dziUrl={dziUrl}
          hotspots={viewerHotspots}
          onImageClick={(xPct, yPct) => setPending({ xPct, yPct })}
        />
      </div>

      {pending && (
        <div className="flex items-center gap-2 rounded-md border border-line-strong p-3">
          <span className="text-sm text-ink-dim">New pin — cell type:</span>
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
            onClick={handleAddPin}
            disabled={!cellTypeId || saving}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add pin"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setCellTypeId("");
            }}
            className="text-sm text-ink-dim underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pins ({pins.length})</h2>
        {pins.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm"
          >
            <span>{p.cell_types?.name ?? "—"}</span>
            <form action={deletePin}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="exercise_id" value={exerciseId} />
              <button type="submit" className="text-xs text-danger underline">
                Remove
              </button>
            </form>
          </div>
        ))}
        {pins.length === 0 && <p className="text-sm text-ink-faint">No pins yet.</p>}
      </div>
    </div>
  );
}
