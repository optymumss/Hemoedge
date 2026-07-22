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
        <label className="text-xs text-ink-dim" htmlFor="org-name">Organization name</label>
        <input
          id="org-name"
          name="name"
          required
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="org-seats">Seats (optional)</label>
        <input
          id="org-seats"
          name="seats"
          type="number"
          min={1}
          className="w-24 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create organization"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
