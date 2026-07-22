"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { isOrgAtSeatLimit } from "@/lib/org/check-seat-limit";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { orgInviteEmail } from "@/lib/email/templates";
import { inviteUserByEmail } from "@/lib/auth/invite";
import { requestOrigin } from "@/lib/http/request-origin";

export type FormState = { error?: string } | undefined;

export async function createOrganization(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const seatsRaw = String(formData.get("seats") ?? "").trim();
  const seats = seatsRaw ? Number(seatsRaw) : null;

  if (!name) return { error: "Name is required." };
  if (seats !== null && (!Number.isFinite(seats) || seats < 1)) {
    return { error: "Seats must be a positive number." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .insert({ name, slug: slugify(name), seats });

  if (error) {
    return {
      error: error.code === "23505" ? "An organization with that name already exists." : error.message,
    };
  }

  revalidatePath("/admin/organizations");
  return undefined;
}

export async function addOrgMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const orgRole = String(formData.get("org_role") ?? "member");

  if (!orgId || !email) return { error: "Email is required." };
  if (!["owner", "admin", "member"].includes(orgRole)) {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await isOrgAtSeatLimit(supabase, orgId)) {
    return { error: "This organization has no seats left. Raise its seat count first." };
  }

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  if (!org) return { error: "Organization not found." };

  let profile = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle()
    .then((r) => r.data);

  let invited = false;
  if (!profile) {
    const result = await inviteUserByEmail(email, {
      origin: await requestOrigin(),
      context: org.name,
    });
    if (result.error) return { error: result.error };
    profile = { id: result.userId!, role: "member" };
    invited = true;
  }

  const { error } = await supabase.from("organization_memberships").insert({
    org_id: orgId,
    user_id: profile.id,
    org_role: orgRole,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Already a member of this organization." : error.message,
    };
  }

  // Granting owner/admin needs the platform-level org_admin role to actually
  // reach /org — auto-promote, but never downgrade an existing staff role.
  if ((orgRole === "owner" || orgRole === "admin") && profile.role === "member") {
    await supabase.from("profiles").update({ role: "org_admin" }).eq("id", profile.id);
  }

  if (user) {
    await logAudit(supabase, user.id, "org_member_added", "organization", orgId, {
      member_email: email,
      org_role: orgRole,
    });
  }

  if (!invited) {
    const { subject, html } = orgInviteEmail(org.name);
    await sendEmail(email, subject, html);
  }

  revalidatePath(`/admin/organizations/${orgId}`);
  return undefined;
}

export async function updateOrgTier(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgId = String(formData.get("org_id") ?? "");
  const tierIdRaw = String(formData.get("tier_id") ?? "").trim();
  const seatsRaw = String(formData.get("seats") ?? "").trim();
  const seats = seatsRaw ? Number(seatsRaw) : null;

  if (!orgId) return { error: "Missing organization." };
  if (seats !== null && (!Number.isFinite(seats) || seats < 1)) {
    return { error: "Seats must be a positive number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("organizations")
    .update({ tier_id: tierIdRaw || null, seats })
    .eq("id", orgId);

  if (error) return { error: error.message };

  if (user) {
    await logAudit(supabase, user.id, "org_tier_updated", "organization", orgId, {
      tier_id: tierIdRaw || null,
      seats,
    });
  }

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/organizations");
  return undefined;
}

export async function removeOrgMember(formData: FormData) {
  const membershipId = String(formData.get("membership_id") ?? "");
  const orgId = String(formData.get("org_id") ?? "");
  if (!membershipId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("organization_memberships").delete().eq("id", membershipId);

  if (user) {
    await logAudit(supabase, user.id, "org_member_removed", "organization", orgId, {
      membership_id: membershipId,
    });
  }

  revalidatePath(`/admin/organizations/${orgId}`);
}
