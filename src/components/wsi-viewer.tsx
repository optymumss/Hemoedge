"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";
import { WbcCounterPanel } from "@/components/wbc-counter-panel";

/**
 * Pan/zoom/rotate viewing via OpenSeadragon. Uses a real tiled deep-zoom
 * pyramid (dziUrl) when the slide has been tiled by the WSI tiling pipeline
 * (see src/lib/tiling) — sharp at any zoom, loads only what the viewport
 * needs. Falls back to single-image mode (the whole raw file, no tiling)
 * for slides that haven't been tiled yet or where tiling failed; still
 * gives smooth zoom/pan, just softens past the file's native resolution.
 *
 * openseadragon touches `document` at module-load time, which crashes
 * Next.js's server-side render pass even inside a "use client" component
 * (that pass still imports the module in Node). Importing it lazily inside
 * the effect keeps it out of the SSR path entirely.
 */

// Slides aren't tagged with their scanner's native magnification yet, so
// this assumes the common default (40x) — the preset buttons are relative
// to that, matching how a real microscope objective turret works: "80x" is
// a 2x digital zoom past the 40x capture.
const NATIVE_MAGNIFICATION = 40;
const PRESETS = [10, 20, 40, 80];
const MAGNIFICATION_TOLERANCE = 0.05;

const TONE_COLOR: Record<string, string> = {
  neutral: "#38bdf8",
  answered: "#a78bfa",
  correct: "#22c55e",
  incorrect: "#ef4444",
};

export type WsiHotspot = {
  id: string;
  xPct: number;
  yPct: number;
  tone?: "neutral" | "answered" | "correct" | "incorrect";
};

export function WsiViewer({
  imageUrl,
  dziUrl,
  hotspots,
  onImageClick,
  onHotspotClick,
  enableWbcCounter = false,
  wbcCounterDefaultOpen = false,
  wbcCounterProps,
}: {
  imageUrl: string;
  /** DeepZoom manifest URL for a tiled pyramid — used instead of imageUrl
   * (single full-resolution image mode) when the slide has been tiled.
   * Stays sharp at any zoom and loads only the tiles the viewport needs,
   * rather than the whole file. imageUrl is still required as the fallback
   * for slides that haven't been tiled yet or where tiling failed. */
  dziUrl?: string | null;
  /** Normalized (0-1) pins rendered over the image — the WBC diff counter's
   * ground-truth/answer markers, or teaching-mode annotations. Purely
   * visual; click handling is separate. */
  hotspots?: WsiHotspot[];
  /** Fires with the image-normalized (0-1) coordinates of a plain click —
   * used by the WBC diff counter's annotate/classify modes. Matching a
   * click to the nearest hotspot (within its tolerance) is the caller's
   * job, not the viewer's. */
  onImageClick?: (xPct: number, yPct: number) => void;
  /** When set, hotspot pins themselves become clickable (fires with the
   * hotspot's id) instead of being purely decorative pass-through markers —
   * used by the teaching-mode annotation viewer to reveal a pin's content.
   * Leaving this unset preserves the WBC diff counter's existing behavior
   * where clicks pass through pins to the underlying canvas. */
  onHotspotClick?: (id: string) => void;
  /** Surfaces a "Manual Diff Counter" toggle in the toolbar, docked as an overlay
   * inside the viewer itself (see WbcCounterPanel) instead of a separate
   * block elsewhere on the page — a learner needs to keep scanning the
   * slide while tallying cells, not scroll away from it to use the
   * counter. Off by default: the admin's quick raw-file preview has no use
   * for it, so only the learner-facing AnnotatedSlideViewer enables it. */
  enableWbcCounter?: boolean;
  /** Opens the Manual Diff Counter panel immediately instead of requiring a
   * toolbar click — used by the Manual Diff Counter practice exercise,
   * where counting *is* the point of the page, unlike the case/module
   * viewer where it's an optional aid. */
  wbcCounterDefaultOpen?: boolean;
  /** Extra props forwarded to the counter panel — the practice exercise
   * uses these to mask the running breakdown until submission, show the
   * reference differential afterward, freeze counting once submitted, and
   * read the live tally. Unset for the plain scratch-tool usage. */
  wbcCounterProps?: Omit<React.ComponentProps<typeof WbcCounterPanel>, "onClose">;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const dimensionsRef = useRef<{ x: number; y: number } | null>(null);
  const overlayElsRef = useRef<HTMLElement[]>([]);
  const onImageClickRef = useRef(onImageClick);
  const onHotspotClickRef = useRef(onHotspotClick);
  const [activeMagnification, setActiveMagnification] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isFullPage, setIsFullPage] = useState(false);
  const [counterOpen, setCounterOpen] = useState(wbcCounterDefaultOpen);

  useEffect(() => {
    onImageClickRef.current = onImageClick;
  }, [onImageClick]);

  useEffect(() => {
    onHotspotClickRef.current = onHotspotClick;
  }, [onHotspotClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setLoadError(null);
    setReady(false);

    import("openseadragon").then(({ default: OpenSeadragon }) => {
      if (cancelled || !containerRef.current) return;

      const viewer = OpenSeadragon({
        element: containerRef.current,
        tileSources: dziUrl ?? { type: "image", url: imageUrl },
        // Forced to the plain 2D canvas rather than OpenSeadragon's default
        // (WebGL, when available) so "Save view" below can rely on
        // canvas.toDataURL() working: a WebGL context's drawing buffer is
        // cleared right after each composite unless preserveDrawingBuffer is
        // set, so capturing it later (on a button click, not mid-frame)
        // reliably returns a blank image. The 2D canvas has no such
        // caveat — its pixel content just sits there until redrawn.
        drawer: "canvas",
        // Also required for "Save view": without requesting tiles in CORS
        // mode, the browser marks the canvas "tainted" the moment a
        // cross-origin (R2) tile is drawn onto it, and toDataURL() throws
        // a SecurityError. R2 already answers with
        // Access-Control-Allow-Origin: *, so Anonymous mode just has to be
        // requested for the browser to treat the canvas as exportable.
        crossOriginPolicy: "Anonymous",
        // The overview mini-map isn't useful for a single (non deep-zoom)
        // image — it's just a shrunken duplicate of the same image.
        showNavigator: false,
        // showNavigationControl gates ALL button wiring, not just
        // OpenSeadragon's own icon-based toolbar — it must be true for our
        // custom buttons below to receive click handlers at all. Passing an
        // `element` for each one (an id string, resolved by OpenSeadragon)
        // makes it bind directly to our button instead of creating its own,
        // so this doesn't require OpenSeadragon's icon image assets either.
        showNavigationControl: true,
        showRotationControl: true,
        showFullPageControl: true,
        zoomInButton: "wsi-zoom-in",
        zoomOutButton: "wsi-zoom-out",
        homeButton: "wsi-home",
        rotateLeftButton: "wsi-rotate-left",
        rotateRightButton: "wsi-rotate-right",
        fullPageButton: "wsi-fullscreen",
        gestureSettingsMouse: { clickToZoom: false },
      });
      viewerRef.current = viewer;

      viewer.addHandler("full-screen", (event) => setIsFullPage(event.fullScreen));

      const syncActivePreset = () => {
        const nativeZoom = viewer.viewport.imageToViewportZoom(1);
        const currentZoom = viewer.viewport.getZoom();
        const currentMagnification = (currentZoom / nativeZoom) * NATIVE_MAGNIFICATION;
        const match = PRESETS.find(
          (m) => Math.abs(m - currentMagnification) / m < MAGNIFICATION_TOLERANCE,
        );
        setActiveMagnification(match ?? null);
      };
      viewer.addHandler("zoom", syncActivePreset);
      viewer.addHandler("open", () => {
        syncActivePreset();
        const dims = viewer.world.getItemAt(0)?.source.dimensions;
        if (dims) dimensionsRef.current = { x: dims.x, y: dims.y };
        setReady(true);
      });
      viewer.addHandler("open-failed", () => {
        setLoadError("This slide's image couldn't be loaded. The file may be missing, corrupted, or in an unsupported format.");
      });
      viewer.addHandler("canvas-click", (event) => {
        const handler = onImageClickRef.current;
        if (!event.quick || !handler || !dimensionsRef.current) return;
        const viewportPoint = viewer.viewport.pointFromPixel(event.position);
        const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
        const xPct = imagePoint.x / dimensionsRef.current.x;
        const yPct = imagePoint.y / dimensionsRef.current.y;
        if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return;
        handler(xPct, yPct);
      });
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl, dziUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const dims = dimensionsRef.current;
    if (!viewer || !ready || !dims) return;

    import("openseadragon").then(({ default: OpenSeadragon }) => {
      for (const el of overlayElsRef.current) viewer.removeOverlay(el);
      overlayElsRef.current = [];

      for (const spot of hotspots ?? []) {
        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.4)";
        el.style.background = TONE_COLOR[spot.tone ?? "neutral"];

        if (onHotspotClickRef.current) {
          el.style.pointerEvents = "auto";
          el.style.cursor = "pointer";
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onHotspotClickRef.current?.(spot.id);
          });
        } else {
          el.style.pointerEvents = "none";
        }

        const point = viewer.viewport.imageToViewportCoordinates(
          spot.xPct * dims.x,
          spot.yPct * dims.y,
        );
        viewer.addOverlay({ element: el, location: point, placement: OpenSeadragon.Placement.CENTER });
        overlayElsRef.current.push(el);
      }
    });

    return () => {
      for (const el of overlayElsRef.current) viewer.removeOverlay(el);
      overlayElsRef.current = [];
    };
  }, [hotspots, ready]);

  function goToMagnification(magnification: number) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const nativeZoom = viewer.viewport.imageToViewportZoom(1);
    viewer.viewport.zoomTo(nativeZoom * (magnification / NATIVE_MAGNIFICATION));
  }

  /** Downloads exactly what's currently framed in the viewport — a learner
   * zooms/pans to an area or point of interest, then Save captures that
   * view as a PNG to their device. Not the whole slide (which may be
   * gigapixels): just the rendered canvas, i.e. what's actually on screen. */
  function handleSave() {
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const magnification = activeMagnification ? `-${activeMagnification}x` : "";
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `wsi-view${magnification}-${Date.now()}.png`;
    link.click();
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-white/20 bg-white/5 p-1" role="group" aria-label="Objective magnification">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => goToMagnification(m)}
              aria-pressed={activeMagnification === m}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeMagnification === m
                  ? "bg-accent text-accent-ink"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {m}x
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/20" aria-hidden="true" />
        <button id="wsi-zoom-in" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          Zoom in
        </button>
        <button id="wsi-zoom-out" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          Zoom out
        </button>
        <button id="wsi-home" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          Reset
        </button>
        <button id="wsi-rotate-left" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          Rotate left
        </button>
        <button id="wsi-rotate-right" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          Rotate right
        </button>
        <div className="h-5 w-px bg-white/20" aria-hidden="true" />
        <button id="wsi-fullscreen" type="button" className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          {isFullPage ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <div className="h-5 w-px bg-white/20" aria-hidden="true" />
        <button
          type="button"
          onClick={handleSave}
          disabled={!ready}
          className="rounded-md border border-line-strong px-2 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
          title="Download the current view as a PNG"
        >
          Save
        </button>
        {enableWbcCounter && (
          <>
            <div className="h-5 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setCounterOpen((open) => !open)}
              aria-pressed={counterOpen}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                counterOpen
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line-strong text-white/80 hover:bg-white/10"
              }`}
            >
              Manual Diff Counter
            </button>
          </>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full rounded-md bg-black" />
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/90 px-6 text-center text-sm text-white/80">
            {loadError}
          </div>
        )}
        {enableWbcCounter && counterOpen && (
          <div className="absolute inset-y-0 right-0 w-1/3 min-w-[168px] max-w-[220px] rounded-r-md">
            <WbcCounterPanel onClose={() => setCounterOpen(false)} {...wbcCounterProps} />
          </div>
        )}
      </div>
    </div>
  );
}
