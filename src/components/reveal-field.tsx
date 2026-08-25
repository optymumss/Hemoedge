"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Hides an answer-key field (diagnosis, escalation, etc.) behind a button so
 * a learner works the case out from the presenting data before checking
 * themselves — instead of it being visible the moment the page loads.
 */
export function RevealField({ label, children }: { label: string; children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="mt-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{label}</h2>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-ink-dim hover:bg-surface-sunken"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
      </div>
      {revealed && <div className="mt-1 text-sm text-ink-dim">{children}</div>}
    </div>
  );
}
