"use client";

import { useActionState } from "react";
import { createPlan, type FormState } from "./actions";

export function CreatePlanForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPlan, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="plan-name">Plan name</label>
        <input
          id="plan-name"
          name="name"
          required
          placeholder="New Hire Onboarding"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="plan-description">Description (optional)</label>
        <input
          id="plan-description"
          name="description"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create plan"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
