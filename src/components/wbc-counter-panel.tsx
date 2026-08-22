"use client";

import { useState } from "react";

/**
 * The standard manual WBC differential categories, in reporting order.
 * Fixed (not the admin-managed `cell_types` taxonomy used by the WBC Diff
 * Counter *exercise*, /admin/wbc-diff — that's a different tool: a scored
 * quiz against curated ground-truth pins. This is a free-tally counting aid
 * a learner runs against their own eyes while scanning any slide, so its
 * categories are a fixed clinical convention rather than authored content.
 */
const CATEGORIES = [
  { code: "NEUT", label: "Neutrophils" },
  { code: "LYMPH", label: "Lymphocytes" },
  { code: "MONO", label: "Monocytes" },
  { code: "EOSINO", label: "Eosinophils" },
  { code: "BASO", label: "Basophils" },
  { code: "BLAST", label: "Blasts" },
  { code: "PROMYELO", label: "Promyelocytes" },
  { code: "MYELO", label: "Myelocytes" },
  { code: "METAMYELO", label: "Metamyelocytes" },
  { code: "NRBC", label: "Nucleated red cells" },
] as const;

type CategoryCode = (typeof CATEGORIES)[number]["code"];

const TARGET_COUNT = 100;

function emptyCounts(): Record<CategoryCode, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.code, 0])) as Record<CategoryCode, number>;
}

/**
 * A manual 100-cell WBC differential tally: a learner reviews the whole
 * slide image themselves (panning/zooming with the viewer above) and clicks
 * a category button for each white cell they classify, rather than clicking
 * points on the image — this mirrors counting at a real microscope, where
 * the tool is a side counter, not a pin-placement exercise. Purely a
 * client-side scratch tool: counts reset when the panel is closed or the
 * page reloads, same as the viewer's "Save view" button has no server-side
 * record either.
 */
export function WbcCounterPanel() {
  const [counts, setCounts] = useState<Record<CategoryCode, number>>(emptyCounts);
  const [wbcTotal, setWbcTotal] = useState("");

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const atTarget = total >= TARGET_COUNT;
  const wbcValue = Number(wbcTotal);
  const hasWbcValue = wbcTotal.trim() !== "" && Number.isFinite(wbcValue) && wbcValue > 0;

  function increment(code: CategoryCode) {
    if (total >= TARGET_COUNT) return;
    setCounts((prev) => ({ ...prev, [code]: prev[code] + 1 }));
  }

  function decrement(code: CategoryCode) {
    setCounts((prev) => ({ ...prev, [code]: Math.max(0, prev[code] - 1) }));
  }

  function reset() {
    setCounts(emptyCounts());
    setWbcTotal("");
  }

  return (
    <div className="rounded-md border border-line-strong bg-surface-sunken p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">Manual WBC differential count</p>
          <p className="text-xs text-ink-faint">
            Scan the slide above and click a category for each white cell you classify. Percentages
            update live; enter an FBC WBC count below to see absolute counts too.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-md border border-line-strong px-2 py-1 text-xs text-ink-dim hover:bg-surface-raised"
        >
          Reset count
        </button>
      </div>

      <p className={`mt-3 text-sm font-medium ${atTarget ? "text-success" : "text-ink"}`} role="status">
        {total} / {TARGET_COUNT} counted{atTarget ? " — differential complete" : ""}
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Cell category counts">
        {CATEGORIES.map(({ code, label }) => {
          const count = counts[code];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={code} className="rounded-md border border-line-strong bg-surface-raised p-2 text-center">
              <button
                type="button"
                onClick={() => increment(code)}
                disabled={atTarget}
                title={label}
                className="w-full rounded px-1 py-1 text-xs font-semibold text-ink hover:bg-accent hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
              >
                {code}
              </button>
              <p className="mt-1 text-lg font-semibold text-ink">{count}</p>
              <p className="text-[11px] text-ink-faint">{total > 0 ? `${pct.toFixed(1)}%` : "—"}</p>
              <button
                type="button"
                onClick={() => decrement(code)}
                disabled={count === 0}
                aria-label={`Remove one ${label} count`}
                className="mt-1 text-[11px] text-ink-faint underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                −1
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-strong pt-3">
        <label htmlFor="wbc-counter-total" className="text-xs text-ink-dim">
          Total WBC count from FBC (×10⁹/L), optional:
        </label>
        <input
          id="wbc-counter-total"
          type="number"
          min="0"
          step="0.1"
          value={wbcTotal}
          onChange={(e) => setWbcTotal(e.target.value)}
          placeholder="e.g. 7.2"
          className="w-24 rounded-md border border-line-strong bg-surface-raised px-2 py-1 text-xs text-ink"
        />
      </div>

      {hasWbcValue && total > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-dim sm:grid-cols-5">
          {CATEGORIES.map(({ code }) => {
            const absolute = (counts[code] / total) * wbcValue;
            return (
              <p key={code}>
                {code}: {absolute.toFixed(2)} ×10⁹/L
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
