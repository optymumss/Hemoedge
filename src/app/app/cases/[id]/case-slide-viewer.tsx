"use client";

import { useEffect, useState } from "react";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";
import { recordSlideView } from "@/lib/slides/record-slide-view";
import { WsiViewer } from "@/components/wsi-viewer";

export function CaseSlideViewer({ slideId }: { slideId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSlideViewUrl(slideId).then((result) => {
      if (cancelled) return;
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
    });
    recordSlideView(slideId);
    return () => {
      cancelled = true;
    };
  }, [slideId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!url) return <p className="text-sm text-ink-faint">Loading slide…</p>;

  return (
    <div className="h-[32rem] rounded-md bg-black">
      <WsiViewer imageUrl={url} />
    </div>
  );
}
