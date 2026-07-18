import { createClient } from "@/lib/supabase/server";

export type CurrentOrg = { id: string; name: string; orgRole: string };

/** The organization the signed-in user administers (owner/admin membership), if any. */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_memberships")
    .select("org_role, organizations(id, name)")
    .eq("user_id", user.id)
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
