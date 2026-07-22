"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "./actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="password"
        type="password"
        placeholder="New password"
        aria-label="New password"
        required
        minLength={8}
        className="rounded-md border border-line-strong px-3 py-2 text-sm"
      />
      <input
        name="confirm"
        type="password"
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        required
        minLength={8}
        className="rounded-md border border-line-strong px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
