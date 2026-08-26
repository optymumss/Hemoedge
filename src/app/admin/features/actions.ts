"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateGuardMessage } from "@/lib/content/update-guard";

export type CreateFeatureResult = { featureId: string } | { error: string };

export async function createFeature(
  title: string,
  cellTypeId: string | null,
  definition: string | null,
  whyItMatters: string | null,
  differentialDiagnoses: string | null,
  commonConfusions: string | null,
): Promise<CreateFeatureResult> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("features")
    .insert({
      title: trimmedTitle,
      cell_type_id: cellTypeId,
      definition,
      why_it_matters: whyItMatters,
      differential_diagnoses: differentialDiagnoses,
      common_confusions: commonConfusions,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Couldn't create the feature." };
  }

  revalidatePath("/admin/features");
  return { featureId: data.id };
}

export type ImageUploadTarget = { path: string; token: string } | { error: string };

/** Same direct-to-Storage signed-upload pattern as slide uploads — keeps
 * the image out of the server action's request body. `upsert: true` is
 * required here (not just at upload time) because a feature's path is
 * deterministic (`${featureId}/${fileName}`) — replacing the image on the
 * edit page with a same-named file would otherwise fail with "The resource
 * already exists". */
export async function createFeatureImageUploadTarget(
  featureId: string,
  fileName: string,
): Promise<ImageUploadTarget> {
  const supabase = await createClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${featureId}/${safeName}`;

  const { data: signed, error } = await supabase.storage
    .from("feature-images")
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !signed) {
    return { error: error?.message ?? "Couldn't prepare the image upload." };
  }

  return { path, token: signed.token };
}

export async function confirmFeatureImage(
  featureId: string,
  path: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("features")
    .select("image_path")
    .eq("id", featureId)
    .single();

  const { error } = await supabase
    .from("features")
    .update({ image_path: path })
    .eq("id", featureId)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  // Replacing an image with a differently-named file would otherwise leave
  // the old object behind in storage forever, unreferenced by any row.
  if (existing?.image_path && existing.image_path !== path) {
    await supabase.storage.from("feature-images").remove([existing.image_path]);
  }

  revalidatePath("/admin/features");
  revalidatePath(`/admin/features/${featureId}`);
  return {};
}

export async function removeFeatureImage(featureId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: feature } = await supabase
    .from("features")
    .select("image_path")
    .eq("id", featureId)
    .single();

  if (feature?.image_path) {
    await supabase.storage.from("feature-images").remove([feature.image_path]);
  }

  const { error } = await supabase
    .from("features")
    .update({ image_path: null })
    .eq("id", featureId)
    .select("id")
    .single();
  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath("/admin/features");
  revalidatePath(`/admin/features/${featureId}`);
  return {};
}

export type FormState = { error?: string } | undefined;

export async function updateFeature(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const cellTypeId = String(formData.get("cell_type_id") ?? "") || null;
  const definition = String(formData.get("definition") ?? "").trim() || null;
  const whyItMatters = String(formData.get("why_it_matters") ?? "").trim() || null;
  const differentialDiagnoses = String(formData.get("differential_diagnoses") ?? "").trim() || null;
  const commonConfusions = String(formData.get("common_confusions") ?? "").trim() || null;

  if (!id || !title) return { error: "Title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("features")
    .update({
      title,
      cell_type_id: cellTypeId,
      definition,
      why_it_matters: whyItMatters,
      differential_diagnoses: differentialDiagnoses,
      common_confusions: commonConfusions,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) return { error: updateGuardMessage(error) ?? error.message };

  revalidatePath(`/admin/features/${id}`);
  revalidatePath("/admin/features");
  redirect(`/admin/features/${id}`);
}
