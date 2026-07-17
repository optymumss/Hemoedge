"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function linkModule(formData: FormData) {
  const curriculumId = String(formData.get("curriculum_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!curriculumId || !moduleId) return;

  const supabase = await createClient();
  await supabase.from("curriculum_modules").insert({
    curriculum_id: curriculumId,
    module_id: moduleId,
  });

  revalidatePath(`/admin/curricula/${curriculumId}`);
}

export async function unlinkModule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const curriculumId = String(formData.get("curriculum_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("curriculum_modules").delete().eq("id", id);

  revalidatePath(`/admin/curricula/${curriculumId}`);
}
