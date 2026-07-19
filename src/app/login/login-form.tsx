"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, signup, type AuthState } from "./actions";

export function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "";
  const checkEmail = params.get("check-email") === "1";

  const [loginState, loginAction, loginPending] = useActionState<
    AuthState,
    FormData
  >(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<
    AuthState,
    FormData
  >(signup, undefined);

  return (
    <>
      {checkEmail && (
        <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-ink">
          Check your email to confirm your account, then sign in below.
        </p>
      )}

      <form action={loginAction} className="flex flex-col gap-3">
        <input type="hidden" name="redirect" value={redirectTo} />
        <input
          name="email"
          type="email"
          placeholder="Email"
          aria-label="Email"
          required
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          aria-label="Password"
          required
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
        />
        {loginState?.error && (
          <p className="text-sm text-danger">{loginState.error}</p>
        )}
        <button
          type="submit"
          disabled={loginPending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <details className="text-sm text-ink-dim">
        <summary className="cursor-pointer">
          First time here? Create an account
        </summary>
        <form action={signupAction} className="mt-3 flex flex-col gap-3">
          <input
            name="full_name"
            placeholder="Full name"
            aria-label="Full name"
            required
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            required
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            aria-label="Password"
            required
            minLength={8}
            className="rounded-md border border-line-strong px-3 py-2 text-sm"
          />
          {signupState?.error && (
            <p className="text-sm text-danger">{signupState.error}</p>
          )}
          <button
            type="submit"
            disabled={signupPending}
            className="rounded-md border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {signupPending ? "Creating…" : "Create account"}
          </button>
        </form>
      </details>
    </>
  );
}
