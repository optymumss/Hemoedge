import { createClient } from "@/lib/supabase/server";
import { SlideAnnotator } from "./slide-annotator";

export default async function SlideAnnotationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: slide } = await supabase.from("slides").select("id, title").eq("id", id).single();
  if (!slide) {
    return <p className="text-sm text-ink-dim">Slide not found.</p>;
  }

  const { data: annotations } = await supabase
    .from("slide_annotations")
    .select("id, x_pct, y_pct, label, body")
    .eq("slide_id", id)
    .order("position");

  return (
    <div>
      <h1 className="text-xl font-semibold">{slide.title} — Annotations</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Teaching-mode pins for this slide — visible wherever it&apos;s embedded (case studies,
        module lessons, standalone).
      </p>

      <div className="mt-6">
        <SlideAnnotator slideId={slide.id} annotations={annotations ?? []} />
      </div>
    </div>
  );
}
