import type { createClient } from "@/lib/supabase/server";

type QuestionWithFeatureImage = {
  id: string;
  feature_id: string | null;
  features: { image_path: string | null } | null;
};

/** Signs image_match questions' feature images — feature-images is a private bucket. */
export async function getQuestionImageUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  questions: QuestionWithFeatureImage[],
): Promise<Map<string, string>> {
  const withImages = questions.filter((q) => q.feature_id && q.features?.image_path);
  const entries = await Promise.all(
    withImages.map(async (q) => {
      const { data } = await supabase.storage
        .from("feature-images")
        .createSignedUrl(q.features!.image_path!, 60 * 10);
      return [q.id, data?.signedUrl ?? null] as const;
    }),
  );
  return new Map(entries.filter((e): e is [string, string] => Boolean(e[1])));
}
