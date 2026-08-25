import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AnnotatedSlideViewer } from "@/components/annotated-slide-viewer";

export default async function LearnerSlideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: slide } = await supabase
    .from("slides")
    .select("id, title, slide_categories(name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!slide) {
    return <p className="text-sm text-ink-dim">Slide not found or not yet published.</p>;
  }

  return (
    <div>
      <Link href="/app/library" className="text-sm text-ink-dim hover:underline">
        &larr; Back to Library
      </Link>

      <div className="mt-3">
        {slide.slide_categories?.name && (
          <span className="text-xs uppercase text-ink-faint">{slide.slide_categories.name}</span>
        )}
        <h1 className="mt-1 text-xl font-semibold">{slide.title}</h1>
      </div>

      <div className="mt-4">
        <AnnotatedSlideViewer slideId={slide.id} heightClassName="h-[32rem]" />
      </div>
    </div>
  );
}
