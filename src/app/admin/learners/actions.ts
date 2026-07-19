"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { logAudit } from "@/lib/audit/log";
import { inviteUserByEmail } from "@/lib/auth/invite";
import { requestOrigin } from "@/lib/http/request-origin";

const ROLES: Enums<"app_role">[] = [
  "member",
  "content_manager",
  "org_admin",
  "super_admin",
];

export async function updateRole(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "") as Enums<"app_role">;

  if (!userId || !ROLES.includes(role)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: before } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  await supabase.from("profiles").update({ role }).eq("id", userId);

  if (user) {
    await logAudit(supabase, user.id, "role_changed", "profile", userId, {
      from: before?.role ?? null,
      to: role,
    });
  }

  revalidatePath("/admin/learners");
}

export type InviteState = { error?: string; success?: boolean } | undefined;

/**
 * Content Managers have no public signup path — a Super Admin invites a
 * specific known person by email, which creates their account immediately.
 */
export async function inviteContentManager(
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return {
      error: "That email already has a HemoEdge account — change their role from the table below instead.",
    };
  }

  const result = await inviteUserByEmail(email, {
    fullName: fullName || undefined,
    role: "content_manager",
    origin: await requestOrigin(),
    context: "as a Content Manager",
  });

  if (result.error) return { error: result.error };

  if (user) {
    await logAudit(supabase, user.id, "content_manager_invited", "profile", result.userId ?? null, {
      email,
    });
  }

  revalidatePath("/admin/learners");
  return { success: true };
}
