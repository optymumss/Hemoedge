import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DetailsSummary } from "./details-form";

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: feature } = await supabase
    .from("features")
    .select(
      "id, title, status, cell_type_id, definition, why_it_matters, differential_diagnoses, common_confusions, image_path, audio_path, audio_transcript, video_path, cell_types(name)",
    )
    .eq("id", id)
    .single();

  if (!feature) {
    return <p className="text-sm text-ink-dim">Feature not found.</p>;
  }

  const imageUrl = feature.image_path
    ? (await supabase.storage.from("feature-images").createSignedUrl(feature.image_path, 600)).data
        ?.signedUrl ?? null
    : null;

  return (
    <div>
      <Link href="/admin/features" className="text-sm text-ink-dim hover:underline">
        &larr; Back to Features
      </Link>

      <h1 className="mt-3 text-xl font-semibold">Feature details</h1>

      <div className="mt-6">
        <DetailsSummary feature={feature} cellTypeName={feature.cell_types?.name ?? null} imageUrl={imageUrl} />
      </div>

      {(feature.audio_path || feature.video_path) && (
        <div className="mt-6 rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold">Media</h2>
          <div className="mt-3 flex flex-col gap-3">
            {feature.audio_path && (
              <div>
                <p className="text-xs font-medium text-ink-dim">Audio narration</p>
                <audio controls src={feature.audio_path} className="mt-1 h-8 w-full max-w-md" />
                {feature.audio_transcript && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{feature.audio_transcript}</p>
                )}
              </div>
            )}
            {feature.video_path && (
              <div>
                <p className="text-xs font-medium text-ink-dim">Video</p>
                <video controls src={feature.video_path} className="mt-1 w-full max-w-md rounded-md" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
