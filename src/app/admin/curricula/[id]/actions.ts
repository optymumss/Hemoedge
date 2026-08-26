"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateGuardMessage } from "@/lib/content/update-guard";
import type { Enums } from "@/lib/supabase/database.types";

export type FormState = { error?: string } | undefined;

const LEVELS: Enums<"content_level">[] = ["beginner", "intermediate", "advanced"];
const PATHWAY_TYPES = ["full_pathway", "cpd_pathway", "specialist_pathway", "assessment_preparation"];

export async function updatePathwayDetails(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
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

  if (!id || !title) return { error: "Title is required." };
  if (!LEVELS.includes(level)) return { error: "Choose a level." };
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
  const { error } = await supabase
    .from("curricula")
    .update({
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
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/curricula/${id}`);
  revalidatePath("/admin/curricula");
  redirect(`/admin/curricula/${id}`);
}

export async function linkModule(formData: FormData) {
  const curriculumId = String(formData.get("curriculum_id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!curriculumId || !moduleId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("curriculum_modules")
    .select("position")
    .eq("curriculum_id", curriculumId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  await supabase.from("curriculum_modules").insert({
    curriculum_id: curriculumId,
    module_id: moduleId,
    position: nextPosition,
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

/**
 * Duplicates a published pathway into a new draft row (version + 1, linked
 * back via previous_version_id) instead of editing it in place, so learners
 * already partway through the published version keep working against
 * content that doesn't shift under them mid-pathway.
 */
export async function publishNewVersion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: current } = await supabase
    .from("curricula")
    .select(
      "title, level, pass_threshold, description, pathway_type, learning_outcomes, certificate_awarded, certificate_title, cpd_points, estimated_completion_minutes, version, status",
    )
    .eq("id", id)
    .single();

  if (!current || current.status !== "published") return;

  const { data: created, error } = await supabase
    .from("curricula")
    .insert({
      title: current.title,
      level: current.level,
      pass_threshold: current.pass_threshold,
      description: current.description,
      pathway_type: current.pathway_type,
      learning_outcomes: current.learning_outcomes,
      certificate_awarded: current.certificate_awarded,
      certificate_title: current.certificate_title,
      cpd_points: current.cpd_points,
      estimated_completion_minutes: current.estimated_completion_minutes,
      version: current.version + 1,
      previous_version_id: id,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) return;

  const { data: linkedModules } = await supabase
    .from("curriculum_modules")
    .select("module_id, position")
    .eq("curriculum_id", id);

  if (linkedModules && linkedModules.length > 0) {
    await supabase.from("curriculum_modules").insert(
      linkedModules.map((m) => ({
        curriculum_id: created.id,
        module_id: m.module_id,
        position: m.position,
      })),
    );
  }

  revalidatePath("/admin/curricula");
  redirect(`/admin/curricula/${created.id}`);
}

export async function moveModule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const curriculumId = String(formData.get("curriculum_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !curriculumId) return;

  const supabase = await createClient();
  const { data: linked } = await supabase
    .from("curriculum_modules")
    .select("id, position")
    .eq("curriculum_id", curriculumId)
    .order("position");

  if (!linked) return;

  const index = linked.findIndex((l) => l.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= linked.length) return;

  const current = linked[index];
  const neighbor = linked[swapWith];

  await Promise.all([
    supabase.from("curriculum_modules").update({ position: neighbor.position }).eq("id", current.id),
    supabase.from("curriculum_modules").update({ position: current.position }).eq("id", neighbor.id),
  ]);

  revalidatePath(`/admin/curricula/${curriculumId}`);
}
