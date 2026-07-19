import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { RoleForm } from "./role-form";
import { startImpersonation } from "./impersonation-actions";
import { InviteContentManagerForm } from "./invite-content-manager-form";

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
      <p className="mt-1 text-sm text-ink-dim">
        All registered accounts and their platform role.
      </p>

      <div className="mt-6 rounded-lg border border-line bg-surface-raised p-4">
        <h2 className="text-sm font-semibold">Invite a Content Manager</h2>
        <p className="mt-1 text-xs text-ink-dim">
          Content Managers don&apos;t sign up — invite a specific person by email
          and their account is created for them.
        </p>
        <div className="mt-3">
          <InviteContentManagerForm />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-left text-xs uppercase text-ink-dim">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(learners ?? []).map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{l.full_name || "—"}</td>
                <td className="px-4 py-2 text-ink-dim">{l.email}</td>
                <td className="px-4 py-2 text-ink-dim">
                  {l.organization_memberships?.[0]?.organizations?.name ?? "Individual"}
                </td>
                <td className="px-4 py-2">
                  <RoleForm userId={l.id} role={l.role} />
                </td>
                <td className="px-4 py-2 text-right">
                  {l.id !== profile.id && (
                    <form action={startImpersonation}>
                      <input type="hidden" name="user_id" value={l.id} />
                      <button type="submit" className="text-xs text-ink-dim underline">
                        View as
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(learners ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
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
