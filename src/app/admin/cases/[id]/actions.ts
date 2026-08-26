"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { updateGuardMessage } from "@/lib/content/update-guard";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const ESCALATION_DECISIONS = ["routine", "senior_review", "urgent"];

export async function updateCaseDetails(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
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

  if (!id || !title) return { error: "Title is required." };
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
  const { error } = await supabase
    .from("cases")
    .update({
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
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/cases/${id}`);
  revalidatePath("/admin/cases");
  redirect(`/admin/cases/${id}`);
}

export async function addCaseTag(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const name = String(formData.get("tag_name") ?? "").trim();
  if (!caseId || !name) return;

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

  await supabase.from("case_tags").insert({ case_id: caseId, tag_id: tagId });
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function removeCaseTag(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const tagId = String(formData.get("tag_id") ?? "");
  if (!caseId || !tagId) return;

  const supabase = await createClient();
  await supabase.from("case_tags").delete().eq("case_id", caseId).eq("tag_id", tagId);
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function addCaseFeature(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const featureId = String(formData.get("feature_id") ?? "");
  if (!caseId || !featureId) return;

  const supabase = await createClient();
  await supabase.from("case_features").insert({ case_id: caseId, feature_id: featureId });
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function removeCaseFeature(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const featureId = String(formData.get("feature_id") ?? "");
  if (!caseId || !featureId) return;

  const supabase = await createClient();
  await supabase.from("case_features").delete().eq("case_id", caseId).eq("feature_id", featureId);
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function addCaseModule(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!caseId || !moduleId) return;

  const supabase = await createClient();
  await supabase.from("case_modules").insert({ case_id: caseId, module_id: moduleId });
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function removeCaseModule(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!caseId || !moduleId) return;

  const supabase = await createClient();
  await supabase.from("case_modules").delete().eq("case_id", caseId).eq("module_id", moduleId);
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function addCaseSlide(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const slideId = String(formData.get("slide_id") ?? "");
  if (!caseId || !slideId) return;

  const supabase = await createClient();
  await supabase.from("case_slides").insert({ case_id: caseId, slide_id: slideId });
  revalidatePath(`/admin/cases/${caseId}`);
}

export async function removeCaseSlide(formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  const slideId = String(formData.get("slide_id") ?? "");
  if (!caseId || !slideId) return;

  const supabase = await createClient();
  await supabase.from("case_slides").delete().eq("case_id", caseId).eq("slide_id", slideId);
  revalidatePath(`/admin/cases/${caseId}`);
}
