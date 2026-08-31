import { createClient } from "@/lib/supabase/server";
import { MediaFields } from "@/components/admin/media-fields";
import { FeatureDetailsForm, FeatureImageField } from "../details-form";

export default async function EditFeaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: feature }, { data: cellTypes }] = await Promise.all([
    supabase
      .from("features")
      .select(
        "id, title, status, cell_type_id, definition, why_it_matters, differential_diagnoses, common_confusions, image_path, audio_path, audio_transcript, video_path",
      )
      .eq("id", id)
      .single(),
    supabase.from("cell_types").select("id, name").order("name"),
  ]);

  if (!feature) {
    return <p className="text-sm text-ink-dim">Feature not found.</p>;
  }

  const imageUrl = feature.image_path
    ? (await supabase.storage.from("feature-images").createSignedUrl(feature.image_path, 600)).data
        ?.signedUrl ?? null
    : null;

  return (
    <div>
      <h1 className="text-lg font-semibold">Edit details</h1>

      <div className="mt-6 flex flex-col gap-6">
        <FeatureDetailsForm
          feature={feature}
          cellTypes={cellTypes ?? []}
          cancelHref={`/admin/features/${feature.id}`}
        />
        <FeatureImageField featureId={feature.id} imageUrl={imageUrl} />
        <div className="rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold">Media</h2>
          <p className="mt-1 text-sm text-ink-dim">Optional audio narration or video demonstration.</p>
          <div className="mt-3">
            <MediaFields
              table="features"
              id={feature.id}
              audioUrl={feature.audio_path}
              audioTranscript={feature.audio_transcript}
              videoUrl={feature.video_path}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
