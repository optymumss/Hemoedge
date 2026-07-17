"use client";

import { useActionState } from "react";
import { createSlideCategory, type FormState } from "./actions";

export function CategoryForm({
  parents,
}: {
  parents: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createSlideCategory,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Name</label>
        <input
          name="name"
          required
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Parent (optional)</label>
        <select
          name="parent_id"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Top level (Syndrome Group) —</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Description (optional)</label>
        <input
          name="description"
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add category"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
