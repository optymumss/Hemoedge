"use client";

import { useState } from "react";
import { getSlideViewUrl } from "./actions";
import { WsiViewer } from "@/components/wsi-viewer";

export function ViewSlideButton({ slideId, title }: { slideId: string; title: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function view() {
    setPending(true);
    setError(null);
    const result = await getSlideViewUrl(slideId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUrl(result.url ?? null);
  }

  return (
    <span>
      <button onClick={view} disabled={pending} className="text-xs text-neutral-600 underline">
        {pending ? "Preparing…" : "View"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}

      {url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium text-white">{title}</p>
            <button
              onClick={() => setUrl(null)}
              className="rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <WsiViewer imageUrl={url} />
          </div>
        </div>
      )}
    </span>
  );
}
