import Link from "next/link";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";

/**
 * A static preview of a slide on the dashboard — just an <img>, no
 * OpenSeadragon — that links out to wherever the full interactive viewer
 * lives (a case or module page). Deliberately not the live WsiViewer: the
 * dashboard should showcase the WSI experience without duplicating the
 * full viewer's functionality.
 */
export async function WsiPreviewCard({
  slideId,
  slideTitle,
  href,
}: {
  slideId: string;
  slideTitle: string;
  href: string;
}) {
  const { url, error } = await getSlideViewUrl(slideId);
  if (error || !url) return null;

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-lg border border-line hover:border-line-strong"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Whole Slide Viewer</span>
        <span className="text-xs text-accent">Open in viewer &rarr;</span>
      </div>
      <div className="h-40 bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={slideTitle}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
      <p className="px-3 py-2 text-sm font-medium text-ink">{slideTitle}</p>
    </Link>
  );
}
