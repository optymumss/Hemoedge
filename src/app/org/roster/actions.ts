"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOrgAtSeatLimit } from "@/lib/org/check-seat-limit";

export type FormState = { error?: string } | undefined;

export async function addMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!orgId || !email) return { error: "Email is required." };

  const supabase = await createClient();

  if (await isOrgAtSeatLimit(supabase, orgId)) {
    return { error: "Your organization has no seats left. Contact HemoEdge to add more." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return {
      error: "No HemoEdge account for that email yet — ask them to sign up first, then add them.",
    };
  }

  const { error } = await supabase.from("organization_memberships").insert({
    org_id: orgId,
    user_id: profile.id,
    org_role: "member",
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Already a member of this organization." : error.message,
    };
  }

  revalidatePath("/org/roster");
  return undefined;
}

export async function removeMember(formData: FormData) {
  const membershipId = String(formData.get("membership_id") ?? "");
  if (!membershipId) return;

  const supabase = await createClient();
  await supabase.from("organization_memberships").delete().eq("id", membershipId);

  revalidatePath("/org/roster");
}
