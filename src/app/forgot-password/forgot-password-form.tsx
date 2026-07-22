"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetState } from "@/app/login/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    undefined,
  );

  if (state?.success) {
    return (
      <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-ink">
        If an account exists for that email, a reset link is on its way.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        aria-label="Email"
        required
        className="rounded-md border border-line-strong px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
