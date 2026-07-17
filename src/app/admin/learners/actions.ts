"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

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
  await supabase.from("profiles").update({ role }).eq("id", userId);

  revalidatePath("/admin/learners");
}
