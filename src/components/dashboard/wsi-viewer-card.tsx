import Link from "next/link";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { WsiViewer } from "@/components/wsi-viewer";
import { MicroscopeIcon } from "@/components/dashboard/section-icons";

/**
 * The dashboard's live, interactive Whole Slide Viewer — not a static
 * preview. Showcasing the WSI learning experience is one of HemoEdge's
 * main differentiators, so this embeds the real viewer (with the Manual
 * Diff Counter) directly, with "Open in Viewer" linking out to the full
 * case/module page for continued work. Replaces the earlier static
 * WsiPreviewCard, whose own docstring predates this decision.
 */
export async function WsiViewerCard({
  slideId,
  slideTitle,
  href,
}: {
  slideId: string;
  slideTitle: string;
  href: string;
}) {
  const { url, dziUrl, error } = await getSlideViewUrl(slideId);
  if (error || !url) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-sunken px-3 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent">
            <MicroscopeIcon />
            Whole Slide Viewer
          </p>
          <p className="truncate text-sm text-ink">{slideTitle}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink"
        >
          Open in Viewer &rarr;
        </Link>
      </div>
      <div className="h-[260px]">
        <WsiViewer imageUrl={url} dziUrl={dziUrl} enableWbcCounter />
      </div>
    </div>
  );
}
