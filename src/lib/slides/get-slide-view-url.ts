"use server";

import { createClient } from "@/lib/supabase/server";
import { isR2Url } from "@/lib/r2";

export async function getSlideViewUrl(
  slideId: string,
): Promise<{ url?: string; dziUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("file_path, tiling_status, tile_manifest_url")
    .eq("id", slideId)
    .single();

  if (!slide?.file_path) return { error: "This slide has no file yet." };

  // A tiled pyramid renders sharp at any zoom and stays fast on weak
  // connections; the raw file (below) is only ever a fallback for slides
  // that haven't been tiled yet, or where tiling failed.
  const dziUrl = slide.tiling_status === "ready" && slide.tile_manifest_url ? slide.tile_manifest_url : undefined;

  // New uploads store their public R2 URL directly in file_path — no
  // signing needed. Older rows still hold a bare Supabase Storage key.
  if (isR2Url(slide.file_path)) {
    return { url: slide.file_path, dziUrl };
  }

  const { data, error } = await supabase.storage
    .from("slides")
    .createSignedUrl(slide.file_path, 60 * 10);

  if (error || !data) return { error: error?.message ?? "Couldn't create a view link." };

  return { url: data.signedUrl, dziUrl };
}
