"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, signup, type AuthState } from "./actions";

type SignupRole = "member" | "content_manager" | "org_admin";

const SIGNUP_ROLE_OPTIONS: { value: SignupRole; label: string; description: string }[] = [
  { value: "member", label: "Learner", description: "Take courses and quizzes." },
  {
    value: "content_manager",
    label: "Content Manager",
    description: "Create slides, modules, and quizzes for review.",
  },
  {
    value: "org_admin",
    label: "Organization Admin",
    description: "Manage a team and assign them training.",
  },
];

export function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "";
  const checkEmail = params.get("check-email") === "1";
  const accountDeleted = params.get("deleted") === "1";
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );

  const [loginState, loginAction, loginPending] = useActionState<
    AuthState,
    FormData
  >(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<
    AuthState,
    FormData
  >(signup, undefined);
  const [signupRole, setSignupRole] = useState<SignupRole>("member");

  return (
    <div className="flex flex-col gap-5">
      {checkEmail && (
        <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-ink">
          Check your email to confirm your account, then sign in below.
        </p>
      )}
      {accountDeleted && (
        <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-ink">
          Your account has been deleted.
        </p>
      )}

      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="flex rounded-md bg-surface-sunken p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => setMode("signin")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "signin"
              ? "bg-surface-raised text-ink shadow-sm"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "signup"
              ? "bg-surface-raised text-ink shadow-sm"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          Create account
        </button>
      </div>

      {mode === "signin" ? (
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
          <div className="flex flex-col gap-1.5">
            <input
              name="password"
              type="password"
              placeholder="Password"
              aria-label="Password"
              required
              className="rounded-md border border-line-strong px-3 py-2 text-sm"
            />
            <Link href="/forgot-password" className="self-end text-xs text-ink-dim underline">
              Forgot password?
            </Link>
          </div>
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
      ) : (
        <form action={signupAction} className="flex flex-col gap-3">
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

          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="I'm signing up as">
            <span className="text-xs text-ink-dim">I&apos;m signing up as</span>
            {SIGNUP_ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  signupRole === option.value
                    ? "border-accent bg-accent-soft text-accent-soft-ink"
                    : "border-line-strong text-ink hover:bg-surface-sunken"
                }`}
              >
                <input
                  type="radio"
                  name="signup_role"
                  value={option.value}
                  checked={signupRole === option.value}
                  onChange={() => setSignupRole(option.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-ink-dim">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          {signupRole === "org_admin" && (
            <input
              name="org_name"
              placeholder="Organization name"
              aria-label="Organization name"
              required
              className="rounded-md border border-line-strong px-3 py-2 text-sm"
            />
          )}

          {signupState?.error && (
            <p className="text-sm text-danger">{signupState.error}</p>
          )}
          <button
            type="submit"
            disabled={signupPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {signupPending ? "Creating…" : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
