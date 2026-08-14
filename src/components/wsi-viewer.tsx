"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragon from "openseadragon";

/**
 * Real pan/zoom/rotate viewing via OpenSeadragon's single-image mode.
 * This is not a tiled deep-zoom pyramid — building one from a raw WSI file
 * (SVS etc.) needs OpenSlide/libvips running a tiling pipeline, which is a
 * separate infrastructure piece. Single-image mode still gives smooth
 * zoom/pan on the full-resolution file without that pipeline.
 *
 * openseadragon touches `document` at module-load time, which crashes
 * Next.js's server-side render pass even inside a "use client" component
 * (that pass still imports the module in Node). Importing it lazily inside
 * the effect keeps it out of the SSR path entirely.
 */

// Slides aren't tagged with their scanner's native magnification yet, so
// this assumes the common default (40x) — the preset buttons are relative
// to that, matching how a real microscope objective turret works: "80x" is
// a 2x digital zoom past the 40x capture, "4x" is a 10x zoom-out from it.
const NATIVE_MAGNIFICATION = 40;
const PRESETS = [4, 10, 20, 40, 80];
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
  hotspots,
  onImageClick,
}: {
  imageUrl: string;
  /** Normalized (0-1) pins rendered over the image — the WBC diff counter's
   * ground-truth/answer markers. Purely visual; click handling is separate. */
  hotspots?: WsiHotspot[];
  /** Fires with the image-normalized (0-1) coordinates of a plain click —
   * used by the WBC diff counter's annotate/classify modes. Matching a
   * click to the nearest hotspot (within its tolerance) is the caller's
   * job, not the viewer's. */
  onImageClick?: (xPct: number, yPct: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const dimensionsRef = useRef<{ x: number; y: number } | null>(null);
  const overlayElsRef = useRef<HTMLElement[]>([]);
  const onImageClickRef = useRef(onImageClick);
  const [activeMagnification, setActiveMagnification] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isFullPage, setIsFullPage] = useState(false);

  useEffect(() => {
    onImageClickRef.current = onImageClick;
  }, [onImageClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setLoadError(null);
    setReady(false);

    import("openseadragon").then(({ default: OpenSeadragon }) => {
      if (cancelled || !containerRef.current) return;

      const viewer = OpenSeadragon({
        element: containerRef.current,
        tileSources: { type: "image", url: imageUrl },
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
  }, [imageUrl]);

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
        el.style.pointerEvents = "none";

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
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full rounded-md bg-black" />
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/90 px-6 text-center text-sm text-white/80">
            {loadError}
          </div>
        )}
      </div>
    </div>
  );
}
