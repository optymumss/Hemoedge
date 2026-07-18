"use client";

import { useState } from "react";
import { getSlideViewUrl } from "./actions";

export function ViewSlideButton({ slideId }: { slideId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function view() {
    setPending(true);
    setError(null);
    const result = await getSlideViewUrl(slideId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <span>
      <button onClick={view} disabled={pending} className="text-xs text-neutral-600 underline">
        {pending ? "Preparing…" : "View"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}
