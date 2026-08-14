"use client";

import { useEffect, useState } from "react";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { recordSlideView } from "@/lib/slides/record-slide-view";
import { getSlideAnnotations, type SlideAnnotation } from "@/lib/slides/get-slide-annotations";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";

/**
 * The learner-facing slide viewer: fetches the slide URL and its teaching
 * annotations (if any), and — only when annotations exist — offers an
 * Explore / Teaching mode toggle. Explore hides the pins entirely; Teaching
 * mode shows them and reveals a pin's label/explanation when tapped. Used
 * anywhere a slide is embedded (case studies, module lessons, standalone),
 * since annotations belong to the slide itself rather than one context.
 */
export function AnnotatedSlideViewer({
  slideId,
  heightClassName = "h-[32rem]",
}: {
  slideId: string;
  heightClassName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [dziUrl, setDziUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<SlideAnnotation[]>([]);
  const [mode, setMode] = useState<"explore" | "teaching">("teaching");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSlideViewUrl(slideId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
      if (result.dziUrl) setDziUrl(result.dziUrl);
    });
    getSlideAnnotations(slideId).then((a) => {
      if (!cancelled) setAnnotations(a);
    });
    recordSlideView(slideId);
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!url) return <p className="text-sm text-ink-faint">Loading slide…</p>;

  const hotspots: WsiHotspot[] =
    mode === "teaching"
      ? annotations.map((a) => ({
          id: a.id,
          xPct: a.x_pct,
          yPct: a.y_pct,
          tone: a.id === selectedId ? "answered" : "neutral",
        }))
      : [];

  const selected = annotations.find((a) => a.id === selectedId);

  return (
    <div className="flex flex-col gap-2">
      {annotations.length > 0 && (
        <div className="flex items-center gap-2">
          <div
            className="flex gap-1 rounded-md border border-line-strong bg-surface-sunken p-1"
            role="group"
            aria-label="Viewing mode"
          >
            <button
              type="button"
              onClick={() => {
                setMode("explore");
                setSelectedId(null);
              }}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                mode === "explore" ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => setMode("teaching")}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                mode === "teaching" ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
              }`}
            >
              Teaching mode
            </button>
          </div>
          {mode === "teaching" && (
            <span className="text-xs text-ink-faint">Tap a pin to see what it shows.</span>
          )}
        </div>
      )}
      <div className={`${heightClassName} rounded-md bg-black`}>
        <WsiViewer
          imageUrl={url}
          dziUrl={dziUrl}
          hotspots={hotspots}
          onHotspotClick={mode === "teaching" ? (id) => setSelectedId(id) : undefined}
        />
      </div>
      {mode === "teaching" && selected && (
        <div className="rounded-md border border-line-strong bg-surface-sunken p-3">
          <p className="text-sm font-medium text-ink">{selected.label}</p>
          {selected.body && <p className="mt-1 text-sm text-ink-dim">{selected.body}</p>}
        </div>
      )}
    </div>
  );
}
