"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/auth/account-actions";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Profile information</h2>
        <p className="mt-1 text-sm text-ink-dim">Update your name and email address.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-xs text-ink-dim">
          Name
        </label>
        <input
          id="profile-name"
          name="full_name"
          defaultValue={fullName}
          required
          className="max-w-sm rounded-md border border-line-strong px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-email" className="text-xs text-ink-dim">
          Email address
        </label>
        <input
          id="profile-email"
          name="email"
          type="email"
          defaultValue={email}
          required
          className="max-w-sm rounded-md border border-line-strong px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
