import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, r2PublicUrl, r2KeyFromPublicUrl } from "@/lib/r2";
import { validateMediaFile, type MediaKind } from "./media-limits";

export type { MediaKind };

export type MediaUploadTarget = { key: string; uploadUrl: string; publicUrl: string } | { error: string };

/** Server-only: presigned R2 PUT, same direct-to-storage pattern as slide
 * uploads — the file bytes never pass through this server, so a 500MB video
 * isn't bounded by the server action's request body limit. `ownerId` scopes
 * the key so unrelated rows never collide, e.g. `audio/<feature-id>/clip.mp3`. */
export async function createMediaUploadTarget(params: {
  kind: MediaKind;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<MediaUploadTarget> {
  const { kind, ownerId, fileName, contentType, sizeBytes } = params;

  const validationError = validateMediaFile(kind, { type: contentType, size: sizeBytes });
  if (validationError) return { error: validationError };

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${kind}/${ownerId}/${safeName}`;

  try {
    const uploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 10 },
    );
    return { key, uploadUrl, publicUrl: r2PublicUrl(key) };
  } catch {
    return { error: `Couldn't prepare the ${kind} upload.` };
  }
}

/** Best-effort cleanup on replace/remove — an R2 delete failure shouldn't
 * block the DB update that already dropped the reference to it. */
export async function deleteMediaObject(publicUrl: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: r2KeyFromPublicUrl(publicUrl) }),
    );
  } catch {
    // orphaned object; not worth failing the request over
  }
}
