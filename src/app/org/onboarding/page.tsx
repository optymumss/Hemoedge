import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import { CreatePlanForm } from "./create-plan-form";

export default async function OnboardingPlansPage() {
  const org = await getCurrentOrg();
  if (!org) {
    return (
      <ComingSoon
        title="No organization assigned"
        description="This account isn't set as an owner/admin of any organization yet."
      />
    );
  }

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("onboarding_plans")
    .select("id, name, description, onboarding_plan_items(id), onboarding_assignments(id)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Onboarding Plans — {org.name}</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Build a structured onboarding path and assign it to new hires with tracked progress.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <CreatePlanForm orgId={org.id} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {(plans ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/org/onboarding/${p.id}`}
            className="rounded-lg border border-line p-4 hover:bg-surface-raised"
          >
            <p className="text-sm font-medium">{p.name}</p>
            <p className="mt-1 text-xs text-ink-dim">
              {p.onboarding_plan_items?.length ?? 0} item(s) · {p.onboarding_assignments?.length ?? 0} assigned
            </p>
          </Link>
        ))}
        {(plans ?? []).length === 0 && (
          <p className="text-sm text-ink-faint">No onboarding plans yet.</p>
        )}
      </div>
    </div>
  );
}
