import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { OrgForm } from "./org-form";

export default async function OrganizationsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="Organizations are managed by HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, seats, status")
    .order("name");

  const withCounts = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const { count } = await supabase
        .from("organization_memberships")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id);
      return { ...org, memberCount: count ?? 0 };
    }),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">Organizations</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Institutions subscribing to HemoEdge — hospital labs, universities, training bodies.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <OrgForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Seats</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {withCounts.map((org) => (
              <tr key={org.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/organizations/${org.id}`} className="hover:underline">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-dim">
                  {org.memberCount}
                  {org.seats ? ` / ${org.seats}` : ""}
                </td>
                <td className="px-4 py-2 text-ink-dim">{org.seats ?? "Unlimited"}</td>
                <td className="px-4 py-2 capitalize text-ink-dim">{org.status}</td>
              </tr>
            ))}
            {withCounts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
