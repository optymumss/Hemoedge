"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "@/lib/auth/account-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Password</h2>
        <p className="mt-1 text-sm text-ink-dim">Change the password you sign in with.</p>
      </div>
      <div className="flex max-w-sm flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-xs text-ink-dim">
            Current password
          </label>
          <input
            id="current-password"
            name="current_password"
            type="password"
            required
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-xs text-ink-dim">
            New password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-xs text-ink-dim">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirm"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
