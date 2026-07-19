"use client";

import { useActionState } from "react";
import { createFeature, type FormState } from "./actions";

export function FeatureForm({
  cellTypes,
}: {
  cellTypes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createFeature,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-title">Title</label>
        <input
          id="feature-title"
          name="title"
          required
          placeholder="Schistocyte (Red Cell Fragment)"
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-cell-type">Cell type (optional)</label>
        <select
          id="feature-cell-type"
          name="cell_type_id"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          {cellTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-definition">Definition (optional)</label>
        <input
          id="feature-definition"
          name="definition"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft feature"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
