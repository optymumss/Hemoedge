"use client";

import { useActionState } from "react";
import { createCellType, type FormState } from "./actions";

export function CellTypeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCellType,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="cell-type-name">Name</label>
        <input
          id="cell-type-name"
          name="name"
          required
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="cell-type-code">Code</label>
        <input
          id="cell-type-code"
          name="code"
          required
          maxLength={5}
          placeholder="SPH"
          className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm uppercase"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500" htmlFor="cell-type-lineage">Lineage</label>
        <select
          id="cell-type-lineage"
          name="lineage"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose…
          </option>
          <option value="red_cell">Red Cell</option>
          <option value="white_cell">White Cell</option>
          <option value="platelet">Platelet</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add cell type"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
