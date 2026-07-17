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
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Check your email to confirm your account, then sign in below.
        </p>
      )}

      <form action={loginAction} className="flex flex-col gap-3">
        <input type="hidden" name="redirect" value={redirectTo} />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {loginState?.error && (
          <p className="text-sm text-red-600">{loginState.error}</p>
        )}
        <button
          type="submit"
          disabled={loginPending}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loginPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer">
          First time here? Create an account
        </summary>
        <form action={signupAction} className="mt-3 flex flex-col gap-3">
          <input
            name="full_name"
            placeholder="Full name"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            minLength={8}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {signupState?.error && (
            <p className="text-sm text-red-600">{signupState.error}</p>
          )}
          <button
            type="submit"
            disabled={signupPending}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {signupPending ? "Creating…" : "Create account"}
          </button>
        </form>
      </details>
    </>
  );
}
