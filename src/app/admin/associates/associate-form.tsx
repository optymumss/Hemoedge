"use client";

import { useActionState } from "react";
import { createAssociate, type FormState } from "./actions";

export function AssociateForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createAssociate,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="associate-name">Name</label>
        <input
          id="associate-name"
          name="name"
          required
          className="w-48 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="associate-title">Title (optional)</label>
        <input
          id="associate-title"
          name="title"
          className="w-48 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="associate-bio">Bio (optional)</label>
        <input
          id="associate-bio"
          name="bio"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add associate"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
