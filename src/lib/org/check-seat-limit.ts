import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Null/unset seats means unlimited. Returns true when the org is already at capacity. */
export async function isOrgAtSeatLimit(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<boolean> {
  const { data: org } = await supabase
    .from("organizations")
    .select("seats")
    .eq("id", orgId)
    .single();

  if (!org?.seats) return false;

  const { count } = await supabase
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  return (count ?? 0) >= org.seats;
}
