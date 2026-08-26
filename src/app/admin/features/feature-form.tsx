"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createContentMediaUploadTarget, confirmContentMedia } from "@/lib/media/content-media";
import { validateMediaFile } from "@/lib/media/media-limits";
import { createFeature, createFeatureImageUploadTarget, confirmFeatureImage } from "./actions";

export function FeatureForm({
  cellTypes,
}: {
  cellTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const cellTypeId = String(data.get("cell_type_id") ?? "") || null;
    const definition = String(data.get("definition") ?? "").trim() || null;
    const whyItMatters = String(data.get("why_it_matters") ?? "").trim() || null;
    const differentialDiagnoses = String(data.get("differential_diagnoses") ?? "").trim() || null;
    const commonConfusions = String(data.get("common_confusions") ?? "").trim() || null;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement;
    const file = fileInput.files?.[0];
    const audioInput = form.elements.namedItem("audio") as HTMLInputElement;
    const audioFile = audioInput.files?.[0];
    const videoInput = form.elements.namedItem("video") as HTMLInputElement;
    const videoFile = videoInput.files?.[0];
    const audioTranscript = String(data.get("audio_transcript") ?? "").trim() || null;

    if (!title) return setError("Title is required.");
    if (audioFile) {
      const audioError = validateMediaFile("audio", audioFile);
      if (audioError) return setError(audioError);
    }
    if (videoFile) {
      const videoError = validateMediaFile("video", videoFile);
      if (videoError) return setError(videoError);
    }

    setPending(true);
    try {
      const created = await createFeature(
        title,
        cellTypeId,
        definition,
        whyItMatters,
        differentialDiagnoses,
        commonConfusions,
      );
      if ("error" in created) {
        setError(created.error);
        return;
      }

      if (file) {
        const target = await createFeatureImageUploadTarget(created.featureId, file.name);
        if ("error" in target) {
          setError(target.error);
          return;
        }

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("feature-images")
          .uploadToSignedUrl(target.path, target.token, file);

        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const confirmed = await confirmFeatureImage(created.featureId, target.path);
        if (confirmed.error) {
          setError(confirmed.error);
          return;
        }
      }

      for (const [kind, mediaFile] of [
        ["audio", audioFile],
        ["video", videoFile],
      ] as const) {
        if (!mediaFile) continue;

        const target = await createContentMediaUploadTarget({
          table: "features",
          id: created.featureId,
          kind,
          fileName: mediaFile.name,
          contentType: mediaFile.type,
          sizeBytes: mediaFile.size,
        });
        if ("error" in target) {
          setError(target.error);
          return;
        }

        const uploadResponse = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mediaFile.type || "application/octet-stream" },
          body: mediaFile,
        });
        if (!uploadResponse.ok) {
          setError("Upload failed — check your connection and try again.");
          return;
        }

        const confirmed = await confirmContentMedia(
          "features",
          created.featureId,
          kind,
          target.key,
          kind === "audio" ? audioTranscript : undefined,
        );
        if (confirmed.error) {
          setError(confirmed.error);
          return;
        }
      }

      formRef.current?.reset();
      router.push(`/admin/features/${created.featureId}`);
    } catch {
      setError("Something went wrong — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-title">Title</label>
          <input
            id="feature-title"
            name="title"
            required
            placeholder="Schistocyte (Red Cell Fragment)"
            className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-cell-type">Cell type (optional)</label>
          <select
            id="feature-cell-type"
            name="cell_type_id"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {cellTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-image">Cropped image (optional)</label>
          <input
            id="feature-image"
            name="image"
            type="file"
            accept="image/*"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-audio">Audio narration (optional)</label>
          <input
            id="feature-audio"
            name="audio"
            type="file"
            accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink-dim" htmlFor="feature-video">Video (optional)</label>
          <input
            id="feature-video"
            name="video"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-audio-transcript">Audio transcript (optional)</label>
        <textarea
          id="feature-audio-transcript"
          name="audio_transcript"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-definition">Definition</label>
        <textarea
          id="feature-definition"
          name="definition"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-why-it-matters">Why it matters</label>
        <textarea
          id="feature-why-it-matters"
          name="why_it_matters"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-differential-diagnoses">Differential diagnoses</label>
        <textarea
          id="feature-differential-diagnoses"
          name="differential_diagnoses"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="feature-common-confusions">Common confusions</label>
        <textarea
          id="feature-common-confusions"
          name="common_confusions"
          rows={2}
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
