import { createClient } from "@/lib/supabase/server";

/** Any organization the signed-in learner belongs to (any role), if one exists. */
export async function getLearnerOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("organization_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}
