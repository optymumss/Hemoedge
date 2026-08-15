import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MediaPlayer } from "@/components/media-player";

export default async function LearnerFeatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: feature } = await supabase
    .from("features")
    .select(
      "id, title, definition, why_it_matters, differential_diagnoses, common_confusions, image_path, audio_path, audio_transcript, video_path, cell_types(name, lineage)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!feature) {
    return <p className="text-sm text-ink-dim">Feature not found or not yet published.</p>;
  }

  let imageUrl: string | null = null;
  if (feature.image_path) {
    const { data } = await supabase.storage
      .from("feature-images")
      .createSignedUrl(feature.image_path, 60 * 10);
    imageUrl = data?.signedUrl ?? null;
  }

  return (
    <div>
      <Link href="/app/library" className="text-sm text-ink-dim hover:underline">
        &larr; Back to Library
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          {feature.cell_types?.name && (
            <span className="text-xs uppercase text-ink-faint">{feature.cell_types.name}</span>
          )}
          <h1 className="mt-1 text-xl font-semibold">{feature.title}</h1>
        </div>
      </div>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed R2/Storage URL, not an optimizable static asset
        <img
          src={imageUrl}
          alt={feature.title}
          className="mt-4 max-h-96 w-full rounded-lg border border-line object-contain"
        />
      )}

      <div className="mt-6 flex flex-col gap-5">
        {feature.definition && (
          <section>
            <h2 className="text-sm font-medium text-ink-dim">Definition</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{feature.definition}</p>
          </section>
        )}
        {feature.why_it_matters && (
          <section>
            <h2 className="text-sm font-medium text-ink-dim">Why it matters</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{feature.why_it_matters}</p>
          </section>
        )}
        {feature.differential_diagnoses && (
          <section>
            <h2 className="text-sm font-medium text-ink-dim">Differential diagnoses</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{feature.differential_diagnoses}</p>
          </section>
        )}
        {feature.common_confusions && (
          <section>
            <h2 className="text-sm font-medium text-ink-dim">Common confusions</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{feature.common_confusions}</p>
          </section>
        )}

        <MediaPlayer
          audioUrl={feature.audio_path}
          audioTranscript={feature.audio_transcript}
          videoUrl={feature.video_path}
        />
      </div>
    </div>
  );
}
