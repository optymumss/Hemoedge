"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestOrigin } from "@/lib/http/request-origin";
import { logAudit } from "@/lib/audit/log";
import type { Database } from "@/lib/supabase/database.types";

type TableName = keyof Database["public"]["Tables"];

export type ProfileState = { error?: string; success?: string } | undefined;

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!fullName) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { error: nameError } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (nameError) return { error: nameError.message };

  if (email !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${await requestOrigin()}/auth/confirm?type=email_change&next=/` },
    );
    if (emailError) return { error: emailError.message };
    return {
      success:
        "Name updated. Check both your old and new inbox for confirmation links to finish changing your email.",
    };
  }

  return { success: "Profile updated." };
}

export type PasswordState = { error?: string; success?: string } | undefined;

export async function changePassword(
  _prevState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!currentPassword) return { error: "Enter your current password." };
  if (password.length < 8) return { error: "New password must be at least 8 characters." };
  if (password !== confirm) return { error: "New passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    current_password: currentPassword,
  });
  if (error) return { error: error.message };

  return { success: "Password updated." };
}

/** Tables where profiles.id is a NO ACTION foreign key — deleting the
 * account would fail with a raw FK violation if any of these still
 * reference the user, so we check first and explain instead of crashing. */
const AUTHORSHIP_CHECKS: { table: TableName; column: string; label: string }[] = [
  { table: "slides", column: "created_by", label: "slides" },
  { table: "features", column: "created_by", label: "features" },
  { table: "modules", column: "created_by", label: "modules" },
  { table: "cases", column: "created_by", label: "cases" },
  { table: "curricula", column: "created_by", label: "curricula" },
  { table: "quiz_questions", column: "created_by", label: "quiz questions" },
  { table: "org_catalog_selections", column: "added_by", label: "catalog selections" },
  { table: "content_reviews", column: "submitted_by", label: "content submissions" },
  { table: "content_reviews", column: "reviewed_by", label: "content reviews" },
];

export type DeleteAccountState = { error?: string } | undefined;

export async function deleteOwnAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const confirmText = String(formData.get("confirm") ?? "");
  if (confirmText !== "DELETE") {
    return { error: 'Type "DELETE" to confirm.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired — sign in again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "super_admin") {
    return { error: "Super Admin accounts can't be self-deleted." };
  }

  const checks = await Promise.all(
    AUTHORSHIP_CHECKS.map(async ({ table, column, label }) => {
      const { data } = await supabase.from(table).select("id").eq(column, user.id).limit(1);
      return data && data.length > 0 ? label : null;
    }),
  );
  const blockers = checks.filter((c): c is string => c !== null);
  if (blockers.length > 0) {
    return {
      error: `You can't delete your account while you've authored ${blockers.join(", ")} — ask a Super Admin to reassign or remove them first.`,
    };
  }

  await logAudit(supabase, user.id, "account_deleted", "profile", user.id, {
    email: user.email ?? null,
  });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
