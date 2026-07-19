import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { AddMemberForm } from "./add-member-form";
import { OrgTierForm } from "./tier-form";
import { removeOrgMember } from "../actions";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="Organizations are managed by HemoEdge staff."
      />
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, seats, status, tier_id, tiers(name)")
    .eq("id", id)
    .single();

  const { data: members } = await supabase
    .from("organization_memberships")
    .select("id, org_role, profiles(full_name, email)")
    .eq("org_id", id)
    .order("org_role");

  const { data: tiers } = await supabase.from("tiers").select("id, name").order("name");

  if (!org) {
    return <p className="text-sm text-ink-dim">Organization not found.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{org.name}</h1>
      <p className="mt-1 text-sm text-ink-dim">
        {(members ?? []).length} member{(members ?? []).length === 1 ? "" : "s"}
        {org.seats ? ` of ${org.seats} seats` : " — unlimited seats"} · {org.status} ·{" "}
        {org.tiers?.name ?? "No tier"}
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <h2 className="text-sm font-medium">Tier & seats</h2>
        <div className="mt-3">
          <OrgTierForm
            orgId={org.id}
            tiers={tiers ?? []}
            currentTierId={org.tier_id}
            currentSeats={org.seats}
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <AddMemberForm orgId={org.id} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">
                  {m.profiles?.full_name || "—"}
                </td>
                <td className="px-4 py-2 text-ink-dim">{m.profiles?.email}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{m.org_role}</td>
                <td className="px-4 py-2 text-right">
                  <form action={removeOrgMember}>
                    <input type="hidden" name="membership_id" value={m.id} />
                    <input type="hidden" name="org_id" value={org.id} />
                    <button type="submit" className="text-xs text-danger underline">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
