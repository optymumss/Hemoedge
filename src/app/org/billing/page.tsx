import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import { SubscribeButton } from "./subscribe-button";

function formatPrice(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const { checkout } = await searchParams;
  const supabase = await createClient();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("tier_id, seats, tiers(name, monthly_price_cents, yearly_price_cents)")
    .eq("id", org.id)
    .single();

  const { data: tiers } = await supabase
    .from("tiers")
    .select(
      "id, name, monthly_price_cents, yearly_price_cents, stripe_price_id_monthly, stripe_price_id_yearly",
    )
    .order("monthly_price_cents");

  return (
    <div>
      <h1 className="text-xl font-semibold">Billing</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Current plan: {orgRow?.tiers?.name ?? "No tier"}
        {orgRow?.seats ? ` · ${orgRow.seats} seats` : ""}
      </p>

      {checkout === "success" && (
        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Subscription started — it may take a moment to reflect here.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          Checkout was cancelled.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(tiers ?? []).map((t) => (
          <div key={t.id} className="rounded-lg border border-neutral-200 p-4">
            <p className="font-medium">{t.name}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {formatPrice(t.monthly_price_cents)}/mo · {formatPrice(t.yearly_price_cents)}/yr
            </p>
            <div className="mt-3 flex gap-2">
              <SubscribeButton tierId={t.id} interval="monthly" label="Subscribe monthly" />
              <SubscribeButton tierId={t.id} interval="yearly" label="Subscribe yearly" />
            </div>
          </div>
        ))}
        {(tiers ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">No tiers available yet.</p>
        )}
      </div>
    </div>
  );
}
