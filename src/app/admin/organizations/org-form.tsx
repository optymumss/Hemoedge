"use client";

import { useActionState } from "react";
import { createOrganization, type FormState } from "./actions";

export function OrgForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createOrganization,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Organization name</label>
        <input
          name="name"
          required
          className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Seats (optional)</label>
        <input
          name="seats"
          type="number"
          min={1}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create organization"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
