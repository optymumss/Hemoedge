/** Client-safe: no server-only imports (S3 SDK, env vars), so client
 * components can validate a file locally before spending a round trip on a
 * presigned URL. media-upload.ts re-validates the same rule server-side. */
export type MediaKind = "audio" | "video";

export const ALLOWED_CONTENT_TYPES: Record<MediaKind, ReadonlySet<string>> = {
  audio: new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
};

// Audio narration clips are short; video demonstrations run longer, hence
// the higher cap. Both stay well under Vercel Sandbox/serverless limits
// since uploads go straight from the browser to R2 (see createMediaUploadTarget).
export const MAX_MEDIA_BYTES: Record<MediaKind, number> = {
  audio: 250 * 1024 * 1024,
  video: 500 * 1024 * 1024,
};

export function validateMediaFile(kind: MediaKind, file: { type: string; size: number }): string | null {
  if (!ALLOWED_CONTENT_TYPES[kind].has(file.type)) {
    return `Unsupported ${kind} file type${file.type ? ` (${file.type})` : ""}.`;
  }
  if (file.size > MAX_MEDIA_BYTES[kind]) {
    return `${kind === "audio" ? "Audio" : "Video"} files must be under ${MAX_MEDIA_BYTES[kind] / (1024 * 1024)}MB.`;
  }
  return null;
}
