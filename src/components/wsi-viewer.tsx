"use client";

import { useEffect, useRef } from "react";
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
export function WsiViewer({ imageUrl }: { imageUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("openseadragon").then(({ default: OpenSeadragon }) => {
      if (cancelled || !containerRef.current) return;

      const viewer = OpenSeadragon({
        element: containerRef.current,
        tileSources: { type: "image", url: imageUrl },
        showNavigator: true,
        // Custom buttons below replace the default toolbar, which otherwise
        // needs OpenSeadragon's own icon image assets served from prefixUrl.
        showNavigationControl: false,
        zoomInButton: "wsi-zoom-in",
        zoomOutButton: "wsi-zoom-out",
        homeButton: "wsi-home",
        rotateLeftButton: "wsi-rotate-left",
        rotateRightButton: "wsi-rotate-right",
        gestureSettingsMouse: { clickToZoom: false },
      });
      viewerRef.current = viewer;
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex gap-2">
        <button id="wsi-zoom-in" type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          Zoom in
        </button>
        <button id="wsi-zoom-out" type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          Zoom out
        </button>
        <button id="wsi-home" type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          Reset
        </button>
        <button id="wsi-rotate-left" type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          Rotate left
        </button>
        <button id="wsi-rotate-right" type="button" className="rounded-md border border-neutral-300 px-2 py-1 text-xs">
          Rotate right
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 rounded-md bg-neutral-900" />
    </div>
  );
}
