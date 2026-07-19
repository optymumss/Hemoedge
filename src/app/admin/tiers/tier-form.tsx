"use client";

import { useActionState } from "react";
import { createTier, type FormState } from "./actions";

export function TierForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createTier,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="tier-name">Name</label>
        <input
          id="tier-name"
          name="name"
          required
          placeholder="Professional"
          className="w-48 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="tier-monthly-price">Monthly price (£)</label>
        <input
          id="tier-monthly-price"
          name="monthly_price"
          type="number"
          min={0}
          step="0.01"
          required
          className="w-28 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="tier-yearly-price">Yearly price (£)</label>
        <input
          id="tier-yearly-price"
          name="yearly_price"
          type="number"
          min={0}
          step="0.01"
          required
          className="w-28 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create tier"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
