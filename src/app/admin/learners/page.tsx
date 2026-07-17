import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { RoleForm } from "./role-form";

export default async function LearnersPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return (
      <ComingSoon
        title="Super Admin only"
        description="The full learner roster is managed by HemoEdge staff."
      />
    );
  }

  const supabase = await createClient();
  const { data: learners } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, organization_memberships(org_role, organizations(name))",
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Learners</h1>
      <p className="mt-1 text-sm text-neutral-500">
        All registered accounts and their platform role.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {(learners ?? []).map((l) => (
              <tr key={l.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">{l.full_name || "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{l.email}</td>
                <td className="px-4 py-2 text-neutral-500">
                  {l.organization_memberships?.[0]?.organizations?.name ?? "Individual"}
                </td>
                <td className="px-4 py-2">
                  <RoleForm userId={l.id} role={l.role} />
                </td>
              </tr>
            ))}
            {(learners ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
