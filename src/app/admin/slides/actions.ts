"use server";

import { revalidatePath } from "next/cache";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { r2Client, R2_BUCKET_NAME, r2PublicUrl, isR2Url, r2KeyFromPublicUrl } from "@/lib/r2";
import { triggerTilingJob } from "@/lib/tiling/trigger-tiling-job";

export type UploadTarget =
  | { slideId: string; uploadUrl: string }
  | { error: string };

/** Creates the draft slide row and a presigned R2 PUT URL — the actual file
 * bytes go straight from the browser to R2, never through this server, so
 * large WSI files aren't bounded by the server-action body limit. Stores the
 * object's public URL directly as file_path (R2 needs no signing to read),
 * which is also how downstream code tells a new R2 upload apart from a
 * legacy Supabase Storage key. */
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
  const key = `${slide.id}/${safeName}`;

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: 60 * 10 },
    );
  } catch {
    await supabase.from("slides").delete().eq("id", slide.id);
    return { error: "Couldn't prepare the upload." };
  }

  const { error: updateError } = await supabase
    .from("slides")
    .update({ file_path: r2PublicUrl(key) })
    .eq("id", slide.id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { slideId: slide.id, uploadUrl };
}

export async function confirmSlideUpload(
  slideId: string,
  sizeBytes: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: slide, error } = await supabase
    .from("slides")
    .update({ size_bytes: sizeBytes })
    .eq("id", slideId)
    .select("file_path")
    .single();

  if (error) return { error: error.message };

  // Tiling is best-effort at upload time: a failure to even start it (e.g.
  // misconfigured env vars) shouldn't block the upload itself, which has
  // already succeeded — it just leaves the slide on single-image fallback
  // until a Retry from the admin Slides list.
  if (slide?.file_path) {
    await startTilingJob(supabase, slideId, slide.file_path);
  }

  revalidatePath("/admin/slides");
  return {};
}

async function startTilingJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slideId: string,
  rawFileUrl: string,
) {
  const { data: job } = await supabase
    .from("tiling_jobs")
    .insert({ slide_id: slideId, status: "queued" })
    .select("id, attempts")
    .single();

  if (!job) return;

  await supabase.from("slides").update({ tiling_status: "queued" }).eq("id", slideId);

  const result = await triggerTilingJob({ jobId: job.id, slideId, rawFileUrl });

  if (result.error) {
    await supabase
      .from("tiling_jobs")
      .update({ status: "failed", error: result.error, attempts: job.attempts + 1 })
      .eq("id", job.id);
    await supabase.from("slides").update({ tiling_status: "failed" }).eq("id", slideId);
    return;
  }

  await supabase
    .from("tiling_jobs")
    .update({
      status: "processing",
      sandbox_id: result.sandboxId,
      cmd_id: result.cmdId,
      attempts: job.attempts + 1,
    })
    .eq("id", job.id);
  await supabase.from("slides").update({ tiling_status: "processing" }).eq("id", slideId);
}

/** Re-runs tiling for a slide whose last attempt failed — reuses the same
 * raw file, a fresh tiling_jobs row so the failed attempt's history stays
 * intact rather than being overwritten. */
export async function retryTiling(formData: FormData) {
  const slideId = String(formData.get("id") ?? "");
  if (!slideId) return;

  const supabase = await createClient();
  const { data: slide } = await supabase.from("slides").select("file_path").eq("id", slideId).single();
  if (!slide?.file_path) return;

  await startTilingJob(supabase, slideId, slide.file_path);
  revalidatePath("/admin/slides");
}

/** RLS scopes this to super admins (any slide) and content managers (their
 * own draft or changes-requested slides) — see the "slides: content manager
 * can delete their own draft or bounced work" policy. Deletes the DB row
 * first so a status change that revokes permission mid-flight can't orphan
 * a file with no row left to fix it. */
export async function deleteSlide(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("file_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("slides").delete().eq("id", id);
  if (error) return;

  if (slide?.file_path) {
    if (isR2Url(slide.file_path)) {
      await r2Client.send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2KeyFromPublicUrl(slide.file_path) }),
      );
    } else {
      await supabase.storage.from("slides").remove([slide.file_path]);
    }
  }

  revalidatePath("/admin/slides");
}
