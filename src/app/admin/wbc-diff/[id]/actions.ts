"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { CATEGORIES, type CategoryCode } from "@/lib/wbc-categories";
import { updateGuardMessage } from "@/lib/content/update-guard";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];

export async function updateExerciseDetails(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const slideId = String(formData.get("slide_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "") || null;
  const caseId = String(formData.get("case_id") ?? "") || null;
  const instructions = String(formData.get("instructions") ?? "").trim() || null;
  const cpdRaw = String(formData.get("cpd_points") ?? "0").trim();

  if (!id || !title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) return { error: "Choose a level." };
  if (!slideId) return { error: "Choose a slide." };

  const cpdPoints = Number(cpdRaw);
  if (!Number.isFinite(cpdPoints) || cpdPoints < 0) {
    return { error: "CPD points must be zero or more." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("wbc_diff_exercises")
    .update({
      title,
      level,
      slide_id: slideId,
      module_id: moduleId,
      case_id: caseId,
      instructions,
      cpd_points: cpdPoints,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/wbc-diff/${id}`);
  revalidatePath("/admin/wbc-diff");
  return undefined;
}

export async function updateReferenceDifferential(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing exercise id." };

  const reference: Partial<Record<CategoryCode, number>> = {};
  for (const { code } of CATEGORIES) {
    const raw = String(formData.get(code) ?? "").trim();
    if (raw === "") return { error: `Enter a value for ${code}.` };
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `${code} must be zero or more.` };
    }
    reference[code] = value;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("wbc_diff_exercises")
    .update({ reference_differential: reference })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/wbc-diff/${id}`);
  revalidatePath(`/admin/wbc-diff/${id}/reference`);
  return undefined;
}
