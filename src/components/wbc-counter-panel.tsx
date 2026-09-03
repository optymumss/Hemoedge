"use client";

import { useEffect, useState } from "react";
import {
  WBC_CATEGORIES,
  NRBC,
  TARGET_COUNT,
  emptyCounts,
  type CategoryCode,
} from "@/lib/wbc-categories";

/**
 * A manual 100-cell WBC differential tally, docked as an overlay inside the
 * WSI viewer itself (see wsi-viewer.tsx) rather than a panel below it — a
 * learner needs to count while their eyes stay on the slide, not scroll
 * down to a separate block every time they classify a cell. Sits in the
 * viewer's own letterboxed space, narrow enough that panning/zooming the
 * rest of the image still works underneath it.
 *
 * A learner reviews the whole slide image themselves (panning/zooming with
 * the viewer) and clicks a category for each white cell they classify,
 * rather than clicking points on the image — this mirrors counting at a
 * real microscope, where the tool is a side counter, not a pin-placement
 * exercise. As a free-standing scratch tool (the default), counts reset
 * when the panel is closed or the page reloads, same as the viewer's
 * "Save view" button has no server-side record either.
 *
 * The optional props below turn it into a graded exam mode for the Manual
 * Diff Counter practice exercise: `hideBreakdown` masks the per-category
 * counts/percentages while the learner is still counting (only the running
 * total shows), `referenceDifferential` reveals the expected values for
 * comparison once revealed, `disabled` freezes further counting after
 * submission, and `onCountsChange` lets a parent page read the live tally
 * to submit it. None of this affects the plain scratch-tool usage in
 * cases/modules, which passes none of them.
 */
export function WbcCounterPanel({
  onClose,
  hideBreakdown = false,
  referenceDifferential,
  disabled = false,
  onCountsChange,
}: {
  onClose?: () => void;
  hideBreakdown?: boolean;
  referenceDifferential?: Partial<Record<CategoryCode, number>>;
  disabled?: boolean;
  onCountsChange?: (counts: Record<CategoryCode, number>) => void;
}) {
  const [counts, setCounts] = useState<Record<CategoryCode, number>>(emptyCounts);
  const [wbcTotal, setWbcTotal] = useState("");

  const total = WBC_CATEGORIES.reduce((sum, c) => sum + counts[c.code], 0);
  const atTarget = total >= TARGET_COUNT;
  const nrbcCount = counts[NRBC.code];
  const wbcValue = Number(wbcTotal);
  const hasWbcValue = wbcTotal.trim() !== "" && Number.isFinite(wbcValue) && wbcValue > 0;

  useEffect(() => {
    onCountsChange?.(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  function increment(code: CategoryCode) {
    if (disabled) return;
    if (code !== NRBC.code && total >= TARGET_COUNT) return;
    setCounts((prev) => ({ ...prev, [code]: prev[code] + 1 }));
  }

  function decrement(code: CategoryCode) {
    if (disabled) return;
    setCounts((prev) => ({ ...prev, [code]: Math.max(0, prev[code] - 1) }));
  }

  function reset() {
    if (disabled) return;
    setCounts(emptyCounts());
    setWbcTotal("");
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto border-l border-white/15 bg-black/85 p-2 text-white backdrop-blur-sm">
      <div className="flex items-start justify-between gap-1">
        <p className={`text-xs font-medium ${atTarget ? "text-success" : "text-white"}`} role="status">
          {total}/{TARGET_COUNT} counted
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {!disabled && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
            >
              Reset
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close manual diff counter"
              className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/10"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0.5" role="group" aria-label="Cell category counts">
        {WBC_CATEGORIES.map(({ code, label }) => {
          const count = counts[code];
          const pct = total > 0 ? (count / total) * 100 : 0;
          const ref = referenceDifferential?.[code];
          return (
            <div
              key={code}
              className="flex items-center gap-1 rounded border border-white/10 bg-white/5 pl-1.5 pr-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => increment(code)}
                disabled={disabled || atTarget}
                title={label}
                className="flex-1 rounded px-1 py-0.5 text-left text-[10px] font-semibold leading-tight text-white hover:bg-accent hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
              >
                {code}
              </button>
              <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white">
                {hideBreakdown ? "—" : count}
              </span>
              <span className="w-9 shrink-0 text-right text-[9px] tabular-nums text-white/50">
                {hideBreakdown ? "—" : total > 0 ? `${pct.toFixed(0)}%` : "—"}
              </span>
              {ref !== undefined && (
                <span className="w-12 shrink-0 text-right text-[9px] tabular-nums text-info">
                  ref {ref}%
                </span>
              )}
              <button
                type="button"
                onClick={() => decrement(code)}
                disabled={disabled || count === 0}
                aria-label={`Remove one ${label} count`}
                className="shrink-0 rounded px-1 text-[10px] leading-none text-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                −
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="flex flex-col gap-0.5 border-t border-white/15 pt-1"
        role="group"
        aria-label="Nucleated red cell count"
      >
        <p className="text-[9px] leading-tight text-white/50">NRBCs (not part of the 100 WBCs)</p>
        <div className="flex items-center gap-1 rounded border border-white/10 bg-white/5 pl-1.5 pr-1 py-0.5">
          <button
            type="button"
            onClick={() => increment(NRBC.code)}
            disabled={disabled}
            title={NRBC.label}
            className="flex-1 rounded px-1 py-0.5 text-left text-[10px] font-semibold leading-tight text-white hover:bg-accent hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            {NRBC.code}
          </button>
          <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white">
            {hideBreakdown ? "—" : nrbcCount}
          </span>
          <span className="w-14 shrink-0 text-right text-[9px] tabular-nums text-white/50">
            {hideBreakdown ? "" : `/${TARGET_COUNT} WBCs`}
          </span>
          {referenceDifferential?.[NRBC.code] !== undefined && (
            <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-info">
              ref {referenceDifferential[NRBC.code]}
            </span>
          )}
          <button
            type="button"
            onClick={() => decrement(NRBC.code)}
            disabled={disabled || nrbcCount === 0}
            aria-label={`Remove one ${NRBC.label} count`}
            className="shrink-0 rounded px-1 text-[10px] leading-none text-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            −
          </button>
        </div>
      </div>

      {!hideBreakdown && (
        <div className="mt-auto flex flex-col gap-1 border-t border-white/15 pt-1.5">
          <label htmlFor="wbc-counter-total" className="text-[9px] leading-tight text-white/50">
            FBC WBC total (×10⁹/L)
          </label>
          <input
            id="wbc-counter-total"
            type="number"
            min="0"
            step="0.1"
            value={wbcTotal}
            onChange={(e) => setWbcTotal(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 7.2"
            className="w-full rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
          />
          {hasWbcValue && total > 0 && (
            <div className="mt-0.5 flex flex-col gap-0.5 text-[9px] text-white/60">
              {WBC_CATEGORIES.filter((c) => counts[c.code] > 0).map(({ code }) => (
                <p key={code} className="tabular-nums">
                  {code}: {((counts[code] / total) * wbcValue).toFixed(2)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
