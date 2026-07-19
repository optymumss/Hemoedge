"use client";

import { useActionState } from "react";
import { inviteContentManager, type InviteState } from "./actions";

export function InviteContentManagerForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    inviteContentManager,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="cm-full-name" className="text-xs text-ink-dim">
          Full name
        </label>
        <input
          id="cm-full-name"
          name="full_name"
          placeholder="Full name"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cm-email" className="text-xs text-ink-dim">
          Email
        </label>
        <input
          id="cm-email"
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Inviting…" : "Invite Content Manager"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-success">Invite sent.</p>}
    </form>
  );
}
