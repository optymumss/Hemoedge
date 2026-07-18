"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UploadTarget =
  | { slideId: string; path: string; token: string }
  | { error: string };

/** Creates the draft slide row and a signed Storage upload URL — the actual
 * file bytes go straight from the browser to Storage, never through this
 * server, so large WSI files aren't bounded by the server-action body limit. */
export async function createSlideUploadTarget(
  title: string,
  categoryId: string | null,
  fileName: string,
): Promise<UploadTarget> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: slide, error: insertError } = await supabase
    .from("slides")
    .insert({ title: trimmedTitle, category_id: categoryId, created_by: user.id })
    .select("id")
    .single();

  if (insertError || !slide) {
    return { error: insertError?.message ?? "Couldn't create the slide record." };
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${slide.id}/${safeName}`;

  const { data: signed, error: signError } = await supabase.storage
    .from("slides")
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    await supabase.from("slides").delete().eq("id", slide.id);
    return { error: signError?.message ?? "Couldn't prepare the upload." };
  }

  const { error: updateError } = await supabase
    .from("slides")
    .update({ file_path: path })
    .eq("id", slide.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { slideId: slide.id, path, token: signed.token };
}

export async function confirmSlideUpload(
  slideId: string,
  sizeBytes: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("slides")
    .update({ size_bytes: sizeBytes })
    .eq("id", slideId);

  if (error) return { error: error.message };

  revalidatePath("/admin/slides");
  return {};
}

export async function getSlideViewUrl(
  slideId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("file_path")
    .eq("id", slideId)
    .single();

  if (!slide?.file_path) return { error: "This slide has no file yet." };

  const { data, error } = await supabase.storage
    .from("slides")
    .createSignedUrl(slide.file_path, 60 * 10);

  if (error || !data) return { error: error?.message ?? "Couldn't create a view link." };

  return { url: data.signedUrl };
}
