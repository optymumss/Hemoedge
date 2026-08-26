"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const MODULE_TYPES = ["foundation", "fbc", "morphology", "case_based", "practical", "assessment"];

export async function createModule(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const description = String(formData.get("description") ?? "").trim() || null;
  const moduleType = String(formData.get("module_type") ?? "") || null;
  const learningObjectives = String(formData.get("learning_objectives") ?? "").trim() || null;
  const teachingNotes = String(formData.get("teaching_notes") ?? "").trim() || null;
  const durationRaw = String(formData.get("estimated_duration_minutes") ?? "").trim();
  const cpdRaw = String(formData.get("cpd_points") ?? "0").trim();

  if (!title) return { error: "Title is required." };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("modules")
    .insert({
      title,
      level,
      description,
      module_type: moduleType,
      learning_objectives: learningObjectives,
      teaching_notes: teachingNotes,
      estimated_duration_minutes: estimatedDurationMinutes,
      cpd_points: cpdPoints,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/modules");
  redirect(`/admin/modules/${data.id}`);
}
