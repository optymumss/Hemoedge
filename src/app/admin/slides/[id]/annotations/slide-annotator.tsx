"use client";

import { useEffect, useState } from "react";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { addAnnotation, deleteAnnotation } from "./actions";

type Annotation = {
  id: string;
  x_pct: number;
  y_pct: number;
  label: string;
  body: string | null;
};

export function SlideAnnotator({
  slideId,
  annotations,
}: {
  slideId: string;
  annotations: Annotation[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ xPct: number; yPct: number } | null>(null);
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSlideViewUrl(slideId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
    });
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  const viewerHotspots: WsiHotspot[] = [
    ...annotations.map((a) => ({ id: a.id, xPct: a.x_pct, yPct: a.y_pct, tone: "neutral" as const })),
    ...(pending ? [{ id: "pending", xPct: pending.xPct, yPct: pending.yPct, tone: "correct" as const }] : []),
  ];

  async function handleAddPin() {
    if (!pending || !label.trim()) return;
    setSaving(true);
    const result = await addAnnotation(slideId, pending.xPct, pending.yPct, label, body);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending(null);
    setLabel("");
    setBody("");
  }

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!url) return <p className="text-sm text-ink-faint">Loading slide…</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">
        Click a point on the slide to drop a pin, then add its label and explanation. These show
        up in Teaching mode wherever this slide is embedded.
      </p>
      <div className="h-[32rem] rounded-md bg-black">
        <WsiViewer imageUrl={url} hotspots={viewerHotspots} onImageClick={(xPct, yPct) => setPending({ xPct, yPct })} />
      </div>

      {pending && (
        <div className="flex flex-col gap-2 rounded-md border border-line-strong p-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Auer rod)"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Explanation (optional) — shown when a learner taps this pin in Teaching mode"
            rows={2}
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddPin}
              disabled={!label.trim() || saving}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add pin"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setLabel("");
                setBody("");
              }}
              className="text-sm text-ink-dim underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pins ({annotations.length})</h2>
        {annotations.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-1.5 text-sm">
            <div>
              <span className="font-medium">{a.label}</span>
              {a.body && <span className="ml-2 text-ink-dim">{a.body}</span>}
            </div>
            <form action={deleteAnnotation}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="slide_id" value={slideId} />
              <button type="submit" className="text-xs text-danger underline">
                Remove
              </button>
            </form>
          </div>
        ))}
        {annotations.length === 0 && <p className="text-sm text-ink-faint">No pins yet.</p>}
      </div>
    </div>
  );
}
