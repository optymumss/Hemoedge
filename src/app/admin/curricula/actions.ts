"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const PATHWAY_TYPES = ["full_pathway", "cpd_pathway", "specialist_pathway", "assessment_preparation"];

export async function createCurriculum(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const passThreshold = Number(formData.get("pass_threshold") ?? 70);
  const description = String(formData.get("description") ?? "").trim() || null;
  const pathwayType = String(formData.get("pathway_type") ?? "") || null;
  const learningOutcomes = String(formData.get("learning_outcomes") ?? "").trim() || null;
  const certificateAwarded = formData.get("certificate_awarded") === "on";
  const certificateTitle = String(formData.get("certificate_title") ?? "").trim() || null;
  const cpdRaw = String(formData.get("cpd_points") ?? "0").trim();
  const durationRaw = String(formData.get("estimated_completion_minutes") ?? "").trim();

  if (!title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) {
    return { error: "Choose a level." };
  }
  if (!Number.isFinite(passThreshold) || passThreshold < 1 || passThreshold > 100) {
    return { error: "Pass threshold must be between 1 and 100." };
  }
  if (pathwayType && !PATHWAY_TYPES.includes(pathwayType)) {
    return { error: "Choose a valid pathway type." };
  }

  const cpdPoints = Number(cpdRaw);
  if (!Number.isFinite(cpdPoints) || cpdPoints < 0) {
    return { error: "CPD points must be zero or more." };
  }

  const estimatedCompletionMinutes = durationRaw ? Number(durationRaw) : null;
  if (
    estimatedCompletionMinutes !== null &&
    (!Number.isFinite(estimatedCompletionMinutes) || estimatedCompletionMinutes <= 0)
  ) {
    return { error: "Estimated completion time must be a positive number of minutes." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("curricula")
    .insert({
      title,
      level,
      pass_threshold: passThreshold,
      description,
      pathway_type: pathwayType,
      learning_outcomes: learningOutcomes,
      certificate_awarded: certificateAwarded,
      certificate_title: certificateTitle,
      cpd_points: cpdPoints,
      estimated_completion_minutes: estimatedCompletionMinutes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/curricula");
  redirect(`/admin/curricula/${data.id}`);
}
