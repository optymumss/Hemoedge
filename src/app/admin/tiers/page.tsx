import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { TierForm } from "./tier-form";
import { StripePriceForm } from "./stripe-price-form";

function formatPrice(cents: number) {
  return `£${(cents / 100).toFixed(2)}`;
}

export default async function TiersPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="Pricing and tiers are managed by HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const { data: tiers } = await supabase
    .from("tiers")
    .select(
      "id, name, identifier, monthly_price_cents, yearly_price_cents, stripe_price_id_monthly, stripe_price_id_yearly",
    )
    .order("monthly_price_cents");

  return (
    <div>
      <h1 className="text-xl font-semibold">Tiers</h1>
      <p className="mt-1 text-sm text-neutral-500">Subscription tiers and pricing.</p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <TierForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Identifier</th>
              <th className="px-4 py-2">Monthly</th>
              <th className="px-4 py-2">Yearly</th>
              <th className="px-4 py-2">Stripe prices</th>
            </tr>
          </thead>
          <tbody>
            {(tiers ?? []).map((t) => (
              <tr key={t.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                  {t.identifier}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {formatPrice(t.monthly_price_cents)}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {formatPrice(t.yearly_price_cents)}
                </td>
                <td className="px-4 py-2">
                  <StripePriceForm
                    tierId={t.id}
                    monthlyPriceId={t.stripe_price_id_monthly}
                    yearlyPriceId={t.stripe_price_id_yearly}
                  />
                </td>
              </tr>
            ))}
            {(tiers ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No tiers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
