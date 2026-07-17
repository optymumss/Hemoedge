"use client";

import { useActionState } from "react";
import { addMember, type FormState } from "./actions";

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addMember,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Learner email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="learner@example.com"
          className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add to roster"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
