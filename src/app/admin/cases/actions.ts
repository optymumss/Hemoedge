"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const ESCALATION_DECISIONS = ["routine", "senior_review", "urgent"];

export async function createCase(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "") as Enums<"content_level">;
  const description = String(formData.get("description") ?? "").trim() || null;
  const slideId = String(formData.get("slide_id") ?? "") || null;
  const caseContext = String(formData.get("case_context") ?? "").trim() || null;
  const labValues = String(formData.get("lab_values") ?? "").trim() || null;
  const finalDiagnosis = String(formData.get("final_diagnosis") ?? "").trim() || null;
  const learningPoints = String(formData.get("learning_points") ?? "").trim() || null;
  const timeRaw = String(formData.get("estimated_time_minutes") ?? "").trim();
  const cpdRaw = String(formData.get("cpd_points") ?? "0").trim();
  const caseCategory = String(formData.get("case_category") ?? "").trim() || null;
  const escalationDecision = String(formData.get("escalation_decision") ?? "").trim() || null;
  const suggestedReportComment = String(formData.get("suggested_report_comment") ?? "").trim() || null;

  if (!title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) return { error: "Choose a level." };
  if (escalationDecision && !ESCALATION_DECISIONS.includes(escalationDecision)) {
    return { error: "Choose a valid escalation decision." };
  }

  const estimatedTimeMinutes = timeRaw ? Number(timeRaw) : null;
  if (estimatedTimeMinutes !== null && (!Number.isFinite(estimatedTimeMinutes) || estimatedTimeMinutes <= 0)) {
    return { error: "Estimated time must be a positive number of minutes." };
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
    .from("cases")
    .insert({
      title,
      level,
      description,
      slide_id: slideId,
      case_context: caseContext,
      lab_values: labValues,
      final_diagnosis: finalDiagnosis,
      learning_points: learningPoints,
      estimated_time_minutes: estimatedTimeMinutes,
      cpd_points: cpdPoints,
      case_category: caseCategory,
      escalation_decision: escalationDecision,
      suggested_report_comment: suggestedReportComment,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/cases");
  redirect(`/admin/cases/${data.id}`);
}
