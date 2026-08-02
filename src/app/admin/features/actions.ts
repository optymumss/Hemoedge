"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
 * the image out of the server action's request body. */
export async function createFeatureImageUploadTarget(
  featureId: string,
  fileName: string,
): Promise<ImageUploadTarget> {
  const supabase = await createClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${featureId}/${safeName}`;

  const { data: signed, error } = await supabase.storage
    .from("feature-images")
    .createSignedUploadUrl(path);

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
  const { error } = await supabase
    .from("features")
    .update({ image_path: path })
    .eq("id", featureId);

  if (error) return { error: error.message };

  revalidatePath("/admin/features");
  return {};
}
