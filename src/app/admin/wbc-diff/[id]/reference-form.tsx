"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { WBC_CATEGORIES, NRBC, type CategoryCode } from "@/lib/wbc-categories";
import { updateReferenceDifferential, type FormState } from "./actions";

export function ReferenceForm({
  exerciseId,
  referenceDifferential,
}: {
  exerciseId: string;
  referenceDifferential: Partial<Record<CategoryCode, number>> | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateReferenceDifferential,
    undefined,
  );
  const [values, setValues] = useState<Partial<Record<CategoryCode, string>>>(
    Object.fromEntries(
      [...WBC_CATEGORIES, NRBC].map((c) => [c.code, referenceDifferential?.[c.code]?.toString() ?? ""]),
    ),
  );

  const wbcSum = WBC_CATEGORIES.reduce((sum, c) => sum + (Number(values[c.code]) || 0), 0);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <input type="hidden" name="id" value={exerciseId} />
      <p className="text-sm text-ink-dim">
        The expected differential a learner&apos;s tally is scored against. The 9 WBC categories
        should sum to 100%; NRBC is reported separately, per 100 WBCs.
      </p>

      <div className="flex flex-col gap-2">
        {WBC_CATEGORIES.map(({ code, label }) => (
          <div key={code} className="flex items-center gap-2">
            <label htmlFor={`ref-${code}`} className="w-32 shrink-0 text-sm text-ink" title={label}>
              {code}
            </label>
            <input
              id={`ref-${code}`}
              name={code}
              type="number"
              min={0}
              max={100}
              step={1}
              value={values[code] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [code]: e.target.value }))}
              required
              className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-ink-faint">%</span>
          </div>
        ))}
      </div>

      <p className={`text-xs ${wbcSum === 100 ? "text-success" : "text-warning"}`}>
        WBC categories total: {wbcSum}% {wbcSum !== 100 && "(should sum to 100%)"}
      </p>

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <label htmlFor="ref-NRBC" className="w-32 shrink-0 text-sm text-ink" title={NRBC.label}>
          {NRBC.code}
        </label>
        <input
          id="ref-NRBC"
          name={NRBC.code}
          type="number"
          min={0}
          step={1}
          value={values[NRBC.code] ?? ""}
          onChange={(e) => setValues((prev) => ({ ...prev, [NRBC.code]: e.target.value }))}
          required
          className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-ink-faint">per 100 WBCs</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <Link
          href={`/admin/wbc-diff/${exerciseId}`}
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-sunken"
        >
          Cancel
        </Link>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
