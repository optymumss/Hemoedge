import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";

export type CurrentOrg = { id: string; name: string; orgRole: string };

/** The organization the effective user administers (owner/admin
 * membership), if any. "Effective" is the impersonation target when a
 * Super Admin is viewing as another user, otherwise the signed-in user. */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const userId = await getEffectiveUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_memberships")
    .select("org_role, organizations(id, name)")
    .eq("user_id", userId)
    .in("org_role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (!data?.organizations) return null;

  return {
    id: data.organizations.id,
    name: data.organizations.name,
    orgRole: data.org_role,
  };
}
