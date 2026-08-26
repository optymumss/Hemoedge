"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateGuardMessage } from "@/lib/content/update-guard";
import { slugify } from "@/lib/slugify";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const MODULE_TYPES = ["foundation", "fbc", "morphology", "case_based", "practical", "assessment"];

export async function updateModuleDetails(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const description = String(formData.get("description") ?? "").trim() || null;
  const moduleType = String(formData.get("module_type") ?? "") || null;
  const learningObjectives = String(formData.get("learning_objectives") ?? "").trim() || null;
  const teachingNotes = String(formData.get("teaching_notes") ?? "").trim() || null;
  const durationRaw = String(formData.get("estimated_duration_minutes") ?? "").trim();
  const cpdRaw = String(formData.get("cpd_points") ?? "0").trim();

  if (!id || !title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) return { error: "Choose a level." };
  if (moduleType && !MODULE_TYPES.includes(moduleType)) return { error: "Choose a valid module type." };

  const estimatedDurationMinutes = durationRaw ? Number(durationRaw) : null;
  if (estimatedDurationMinutes !== null && (!Number.isFinite(estimatedDurationMinutes) || estimatedDurationMinutes <= 0)) {
    return { error: "Estimated duration must be a positive number of minutes." };
  }

  const cpdPoints = Number(cpdRaw);
  if (!Number.isFinite(cpdPoints) || cpdPoints < 0) {
    return { error: "CPD points must be zero or more." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({
      title,
      level,
      description,
      module_type: moduleType,
      learning_objectives: learningObjectives,
      teaching_notes: teachingNotes,
      estimated_duration_minutes: estimatedDurationMinutes,
      cpd_points: cpdPoints,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/modules/${id}`);
  revalidatePath("/admin/modules");
  redirect(`/admin/modules/${id}`);
}

export async function addModuleTag(formData: FormData) {
  const moduleId = String(formData.get("module_id") ?? "");
  const name = String(formData.get("tag_name") ?? "").trim();
  if (!moduleId || !name) return;

  const supabase = await createClient();
  const slug = slugify(name);

  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  let tagId = existing?.id;
  if (!tagId) {
    const { data: created, error } = await supabase
      .from("tags")
      .insert({ name, slug })
      .select("id")
      .single();
    if (error || !created) return;
    tagId = created.id;
  }

  await supabase.from("module_tags").insert({ module_id: moduleId, tag_id: tagId });
  revalidatePath(`/admin/modules/${moduleId}`);
}

export async function removeModuleTag(formData: FormData) {
  const moduleId = String(formData.get("module_id") ?? "");
  const tagId = String(formData.get("tag_id") ?? "");
  if (!moduleId || !tagId) return;

  const supabase = await createClient();
  await supabase.from("module_tags").delete().eq("module_id", moduleId).eq("tag_id", tagId);
  revalidatePath(`/admin/modules/${moduleId}`);
}

export async function addModulePrerequisite(formData: FormData) {
  const moduleId = String(formData.get("module_id") ?? "");
  const prerequisiteModuleId = String(formData.get("prerequisite_module_id") ?? "");
  if (!moduleId || !prerequisiteModuleId || moduleId === prerequisiteModuleId) return;

  const supabase = await createClient();
  await supabase
    .from("module_prerequisites")
    .insert({ module_id: moduleId, prerequisite_module_id: prerequisiteModuleId });
  revalidatePath(`/admin/modules/${moduleId}`);
}

export async function removeModulePrerequisite(formData: FormData) {
  const moduleId = String(formData.get("module_id") ?? "");
  const prerequisiteModuleId = String(formData.get("prerequisite_module_id") ?? "");
  if (!moduleId || !prerequisiteModuleId) return;

  const supabase = await createClient();
  await supabase
    .from("module_prerequisites")
    .delete()
    .eq("module_id", moduleId)
    .eq("prerequisite_module_id", prerequisiteModuleId);
  revalidatePath(`/admin/modules/${moduleId}`);
}
