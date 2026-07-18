import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";

/** Any organization the effective learner belongs to (any role), if one
 * exists. "Effective" is the impersonation target when a Super Admin is
 * viewing as another user, otherwise the signed-in user. */
export async function getLearnerOrgId(): Promise<string | null> {
  const userId = await getEffectiveUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}
