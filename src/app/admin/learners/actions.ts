"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { logAudit } from "@/lib/audit/log";

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
