"use client";

import { useActionState } from "react";
import { updateOrgTier, type FormState } from "../actions";

type Tier = { id: string; name: string };

export function OrgTierForm({
  orgId,
  tiers,
  currentTierId,
  currentSeats,
}: {
  orgId: string;
  tiers: Tier[];
  currentTierId: string | null;
  currentSeats: number | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateOrgTier,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="org-tier-select">Tier</label>
        <select
          id="org-tier-select"
          name="tier_id"
          defaultValue={currentTierId ?? ""}
          className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="">No tier</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="org-tier-seats">Seats (blank = unlimited)</label>
        <input
          id="org-tier-seats"
          name="seats"
          type="number"
          min={1}
          defaultValue={currentSeats ?? ""}
          className="w-40 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
