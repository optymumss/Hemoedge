"use client";

import { useEffect, useState } from "react";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { recordSlideView } from "@/lib/slides/record-slide-view";
import { getSlideAnnotations, type SlideAnnotation } from "@/lib/slides/get-slide-annotations";
import { WsiViewer, type WsiHotspot } from "@/components/wsi-viewer";
import type { WbcCounterPanel } from "@/components/wbc-counter-panel";

/**
 * The learner-facing slide viewer: fetches the slide URL and its teaching
 * annotations (if any), and always offers an Explore / Teaching mode
 * toggle — Explore hides pins entirely; Teaching mode shows them and
 * reveals a pin's label/explanation when tapped. The toggle stays visible
 * even before a slide has any annotations yet, so it's discoverable rather
 * than only appearing once a content manager has authored some. The WBC
 * Counter itself now lives inside WsiViewer's own toolbar (see
 * enableWbcCounter there) rather than as a separate block on this page.
 * `teachingLocked` and the `wbcCounter*` props below are for the Manual
 * Diff Counter practice exercise's graded flow; unset, this behaves exactly
 * as it does embedded in a case or module.
 */
export function AnnotatedSlideViewer({
  slideId,
  heightClassName = "h-[32rem]",
  teachingLocked = false,
  wbcCounterDefaultOpen = false,
  wbcCounterProps,
}: {
  slideId: string;
  heightClassName?: string;
  /** Disables the Teaching Mode button — used by the Manual Diff Counter
   * practice exercise so a learner can't peek at teaching labels for the
   * slide's cells before they've submitted their own tally. */
  teachingLocked?: boolean;
  wbcCounterDefaultOpen?: boolean;
  wbcCounterProps?: Omit<React.ComponentProps<typeof WbcCounterPanel>, "onClose">;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [dziUrl, setDziUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<SlideAnnotation[]>([]);
  const [mode, setMode] = useState<"explore" | "teaching">(teachingLocked ? "explore" : "teaching");
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
      <div className="flex flex-wrap items-center gap-2">
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
            Explore Mode
          </button>
          <button
            type="button"
            onClick={() => setMode("teaching")}
            disabled={teachingLocked}
            title={teachingLocked ? "Available after you submit" : undefined}
            className={`rounded px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === "teaching" ? "bg-accent text-accent-ink" : "text-ink-dim hover:bg-surface-raised"
            }`}
          >
            Teaching Mode
          </button>
        </div>
        {teachingLocked && (
          <span className="text-xs text-ink-faint">Teaching Mode unlocks after you submit.</span>
        )}
        {!teachingLocked && mode === "teaching" && (
          <span className="text-xs text-ink-faint">
            {annotations.length > 0
              ? "Tap a pin to see what it shows."
              : "No teaching annotations added for this slide yet."}
          </span>
        )}
      </div>
      <div className={`${heightClassName} rounded-md bg-black`}>
        <WsiViewer
          imageUrl={url}
          dziUrl={dziUrl}
          hotspots={hotspots}
          onHotspotClick={mode === "teaching" ? (id) => setSelectedId(id) : undefined}
          enableWbcCounter
          wbcCounterDefaultOpen={wbcCounterDefaultOpen}
          wbcCounterProps={wbcCounterProps}
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
