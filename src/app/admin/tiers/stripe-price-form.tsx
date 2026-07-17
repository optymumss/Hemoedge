"use client";

import { useActionState } from "react";
import { updateTierStripePrices, type FormState } from "./actions";

export function StripePriceForm({
  tierId,
  monthlyPriceId,
  yearlyPriceId,
}: {
  tierId: string;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateTierStripePrices,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="tier_id" value={tierId} />
      <input
        name="stripe_price_id_monthly"
        placeholder="price_… (monthly)"
        defaultValue={monthlyPriceId ?? ""}
        className="w-36 rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
      />
      <input
        name="stripe_price_id_yearly"
        placeholder="price_… (yearly)"
        defaultValue={yearlyPriceId ?? ""}
        className="w-36 rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      {state?.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
