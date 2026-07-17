import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { ComingSoon } from "@/components/coming-soon";
import { AddMemberForm } from "./add-member-form";
import { removeMember } from "./actions";

export default async function RosterPage() {
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
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("id, org_role, profiles(full_name, email)")
    .eq("org_id", org.id)
    .order("org_role");

  return (
    <div>
      <h1 className="text-xl font-semibold">Roster — {org.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Invite and remove your organization&apos;s learners.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <AddMemberForm orgId={org.id} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id} className="border-t border-neutral-200">
                <td className="px-4 py-2 font-medium">
                  {m.profiles?.full_name || "—"}
                </td>
                <td className="px-4 py-2 text-neutral-500">{m.profiles?.email}</td>
                <td className="px-4 py-2 capitalize text-neutral-500">{m.org_role}</td>
                <td className="px-4 py-2 text-right">
                  {m.org_role === "member" && (
                    <form action={removeMember}>
                      <input type="hidden" name="membership_id" value={m.id} />
                      <button type="submit" className="text-xs text-red-600 underline">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No learners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
