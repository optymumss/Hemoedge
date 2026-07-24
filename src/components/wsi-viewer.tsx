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

export function WsiViewer({ imageUrl }: { imageUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [activeMagnification, setActiveMagnification] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

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
        showFullPageControl: false,
        zoomInButton: "wsi-zoom-in",
        zoomOutButton: "wsi-zoom-out",
        homeButton: "wsi-home",
        rotateLeftButton: "wsi-rotate-left",
        rotateRightButton: "wsi-rotate-right",
        gestureSettingsMouse: { clickToZoom: false },
      });
      viewerRef.current = viewer;

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
      viewer.addHandler("open", syncActivePreset);
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl]);

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
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 rounded-md bg-black" />
    </div>
  );
}
