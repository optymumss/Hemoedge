"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOrgAtSeatLimit } from "@/lib/org/check-seat-limit";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { orgInviteEmail } from "@/lib/email/templates";

export type FormState = { error?: string } | undefined;

export async function addMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!orgId || !email) return { error: "Email is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (user) {
    await logAudit(supabase, user.id, "org_member_added", "organization", orgId, {
      member_email: email,
      org_role: "member",
    });
  }

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  if (org) {
    const { subject, html } = orgInviteEmail(org.name);
    await sendEmail(email, subject, html);
  }

  revalidatePath("/org/roster");
  return undefined;
}

export async function removeMember(formData: FormData) {
  const membershipId = String(formData.get("membership_id") ?? "");
  if (!membershipId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("org_id")
    .eq("id", membershipId)
    .maybeSingle();

  await supabase.from("organization_memberships").delete().eq("id", membershipId);

  if (user && membership) {
    await logAudit(supabase, user.id, "org_member_removed", "organization", membership.org_id, {
      membership_id: membershipId,
    });
  }

  revalidatePath("/org/roster");
}
