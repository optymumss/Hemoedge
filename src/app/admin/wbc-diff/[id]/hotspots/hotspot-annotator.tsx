"use client";

import { useEffect, useState } from "react";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { addHotspot, deleteHotspot } from "./actions";

type Hotspot = {
  id: string;
  x_pct: number;
  y_pct: number;
  cell_type_id: string;
  cell_types: { name: string } | null;
};

export function HotspotAnnotator({
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
    ...hotspots.map((h) => ({ id: h.id, xPct: h.x_pct, yPct: h.y_pct, tone: "neutral" as const })),
    ...(pending ? [{ id: "pending", xPct: pending.xPct, yPct: pending.yPct, tone: "correct" as const }] : []),
  ];

  async function handleAddPin() {
    if (!pending || !cellTypeId) return;
    setSaving(true);
    const result = await addHotspot(exerciseId, pending.xPct, pending.yPct, cellTypeId);
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
        Click a cell on the slide to drop a pin, then pick its type below.
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
            {cellTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
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
        <h2 className="text-sm font-semibold">Pins ({hotspots.length})</h2>
        {hotspots.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm"
          >
            <span>{h.cell_types?.name ?? "—"}</span>
            <form action={deleteHotspot}>
              <input type="hidden" name="id" value={h.id} />
              <input type="hidden" name="exercise_id" value={exerciseId} />
              <button type="submit" className="text-xs text-danger underline">
                Remove
              </button>
            </form>
          </div>
        ))}
        {hotspots.length === 0 && <p className="text-sm text-ink-faint">No pins yet.</p>}
      </div>
    </div>
  );
}
