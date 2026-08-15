"use server";

import { createClient } from "@/lib/supabase/server";
import { r2PublicUrl } from "@/lib/r2";
import { createMediaUploadTarget, deleteMediaObject, type MediaKind, type MediaUploadTarget } from "./media-upload";

export type ContentMediaTable = "modules" | "lessons" | "cases" | "features";
const CONTENT_MEDIA_TABLES: ReadonlySet<string> = new Set(["modules", "lessons", "cases", "features"]);

type MediaClient = Awaited<ReturnType<typeof createClient>>;
type MediaPatch = { audio_path?: string | null; audio_transcript?: string | null; video_path?: string | null };

/** All four content tables share the same three media columns, but each has
 * a distinct generated Update type — dispatching per literal table name
 * (rather than `.from(table)` with a union variable) keeps every branch
 * type-checked against its real table instead of an unsound intersection. */
async function updateMediaColumns(supabase: MediaClient, table: ContentMediaTable, id: string, patch: MediaPatch) {
  switch (table) {
    case "modules":
      return supabase.from("modules").update(patch).eq("id", id);
    case "lessons":
      return supabase.from("lessons").update(patch).eq("id", id);
    case "cases":
      return supabase.from("cases").update(patch).eq("id", id);
    case "features":
      return supabase.from("features").update(patch).eq("id", id);
  }
}

async function selectMediaColumns(supabase: MediaClient, table: ContentMediaTable, id: string) {
  switch (table) {
    case "modules":
      return (await supabase.from("modules").select("audio_path, video_path").eq("id", id).single()).data;
    case "lessons":
      return (await supabase.from("lessons").select("audio_path, video_path").eq("id", id).single()).data;
    case "cases":
      return (await supabase.from("cases").select("audio_path, video_path").eq("id", id).single()).data;
    case "features":
      return (await supabase.from("features").select("audio_path, video_path").eq("id", id).single()).data;
  }
}

/** Exported directly as server actions callable from the shared MediaFields
 * client component — `table` travels over the wire from the browser, so it's
 * revalidated against the known set at runtime rather than trusted from the
 * TS type alone. Row-level authorization still comes from RLS (the same
 * content-manager/super-admin policies every other admin write goes through),
 * this check only guards against a malformed/unknown table name. */
function assertValidTable(table: string): table is ContentMediaTable {
  return CONTENT_MEDIA_TABLES.has(table);
}

export async function createContentMediaUploadTarget(params: {
  table: string;
  id: string;
  kind: MediaKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<MediaUploadTarget> {
  if (!assertValidTable(params.table)) return { error: "Unknown content type." };

  return createMediaUploadTarget({
    kind: params.kind,
    ownerId: `${params.table}/${params.id}`,
    fileName: params.fileName,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });
}

export async function confirmContentMedia(
  table: string,
  id: string,
  kind: MediaKind,
  key: string,
  transcript?: string | null,
): Promise<{ error?: string }> {
  if (!assertValidTable(table)) return { error: "Unknown content type." };

  const url = r2PublicUrl(key);
  const patch: MediaPatch =
    kind === "audio" ? { audio_path: url, audio_transcript: transcript ?? null } : { video_path: url };

  const supabase = await createClient();
  const { error } = await updateMediaColumns(supabase, table, id, patch);
  return error ? { error: error.message } : {};
}

/** Lets an admin correct a transcript without re-uploading the audio it
 * describes. */
export async function updateAudioTranscript(
  table: string,
  id: string,
  transcript: string,
): Promise<{ error?: string }> {
  if (!assertValidTable(table)) return { error: "Unknown content type." };

  const supabase = await createClient();
  const { error } = await updateMediaColumns(supabase, table, id, { audio_transcript: transcript.trim() || null });
  return error ? { error: error.message } : {};
}

/** Replacing a file (not just removing one) is a remove-then-confirm pair
 * from the caller, so this alone covers both remove and replace cleanup. */
export async function removeContentMedia(
  table: string,
  id: string,
  kind: MediaKind,
): Promise<{ error?: string }> {
  if (!assertValidTable(table)) return { error: "Unknown content type." };

  const supabase = await createClient();
  const current = await selectMediaColumns(supabase, table, id);
  const existingUrl = kind === "audio" ? current?.audio_path : current?.video_path;

  const patch: MediaPatch = kind === "audio" ? { audio_path: null, audio_transcript: null } : { video_path: null };
  const { error } = await updateMediaColumns(supabase, table, id, patch);
  if (error) return { error: error.message };

  if (existingUrl) await deleteMediaObject(existingUrl);
  return {};
}
