"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createContentMediaUploadTarget,
  confirmContentMedia,
  removeContentMedia,
  updateAudioTranscript,
  type ContentMediaTable,
} from "@/lib/media/content-media";
import { validateMediaFile, type MediaKind } from "@/lib/media/media-limits";

/** Shared audio/video attachment widget for the Module, Lesson, Case, and
 * Feature admin forms — uploads go straight to R2 via a presigned PUT (same
 * pattern as slide uploads), so this never routes file bytes through a
 * server action. `router.refresh()` re-pulls the parent server component's
 * data after every mutation, since these actions don't call revalidatePath
 * themselves (the correct path differs per caller, e.g. a lesson revalidates
 * its module's page, not its own). */
export function MediaFields({
  table,
  id,
  audioUrl,
  audioTranscript,
  videoUrl,
}: {
  table: ContentMediaTable;
  id: string;
  audioUrl: string | null;
  audioTranscript: string | null;
  videoUrl: string | null;
}) {
  const router = useRouter();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [transcript, setTranscript] = useState(audioTranscript ?? "");
  const [audioPending, setAudioPending] = useState(false);
  const [videoPending, setVideoPending] = useState(false);
  const [transcriptPending, setTranscriptPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadMedia(kind: MediaKind, file: File) {
    const validationError = validateMediaFile(kind, file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    const target = await createContentMediaUploadTarget({
      table,
      id,
      kind,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if ("error" in target) {
      setError(target.error);
      return;
    }

    const uploadResponse = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadResponse.ok) {
      setError("Upload failed — check your connection and try again.");
      return;
    }

    const confirmed = await confirmContentMedia(table, id, kind, target.key, kind === "audio" ? transcript : undefined);
    if (confirmed.error) {
      setError(confirmed.error);
      return;
    }

    router.refresh();
  }

  async function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioPending(true);
    try {
      await uploadMedia("audio", file);
    } finally {
      setAudioPending(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  }

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoPending(true);
    try {
      await uploadMedia("video", file);
    } finally {
      setVideoPending(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function handleRemove(kind: MediaKind) {
    setError(null);
    const result = await removeContentMedia(table, id, kind);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (kind === "audio") setTranscript("");
    router.refresh();
  }

  async function handleSaveTranscript() {
    setTranscriptPending(true);
    setError(null);
    try {
      const result = await updateAudioTranscript(table, id, transcript);
      if (result.error) setError(result.error);
      else router.refresh();
    } finally {
      setTranscriptPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line-strong p-3">
      <div>
        <p className="text-xs font-medium text-ink-dim">Audio narration (optional)</p>
        {audioUrl && (
          <div className="mt-1 flex items-center gap-2">
            <audio controls src={audioUrl} className="h-8 flex-1" />
            <button type="button" onClick={() => handleRemove("audio")} className="shrink-0 text-xs text-danger underline">
              Remove
            </button>
          </div>
        )}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"
          onChange={handleAudioChange}
          disabled={audioPending}
          className="mt-1 text-sm"
        />
        <div className="mt-2 flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor={`transcript-${id}`}>
            Transcript
          </label>
          <textarea
            id={`transcript-${id}`}
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleSaveTranscript}
            disabled={transcriptPending || transcript === (audioTranscript ?? "")}
            className="self-start text-xs text-ink-dim underline disabled:opacity-50"
          >
            {transcriptPending ? "Saving…" : "Save transcript"}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-dim">Video (optional)</p>
        {videoUrl && (
          <div className="mt-1 flex flex-col gap-2">
            <video controls src={videoUrl} className="w-full max-w-md rounded-md" />
            <button type="button" onClick={() => handleRemove("video")} className="self-start text-xs text-danger underline">
              Remove video
            </button>
          </div>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleVideoChange}
          disabled={videoPending}
          className="mt-1 text-sm"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
