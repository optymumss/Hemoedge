import { createClient } from "@/lib/supabase/server";
import { HotspotAnnotator } from "./hotspot-annotator";

export default async function ExerciseHotspotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, slide_id")
    .eq("id", id)
    .single();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found.</p>;
  }

  const [{ data: hotspots }, { data: cellTypes }] = await Promise.all([
    supabase
      .from("wbc_diff_hotspots")
      .select("id, x_pct, y_pct, cell_type_id, cell_types(name)")
      .eq("exercise_id", id)
      .order("created_at"),
    supabase.from("cell_types").select("id, name").eq("lineage", "white_cell").order("name"),
  ]);

  return (
    <HotspotAnnotator
      exerciseId={exercise.id}
      slideId={exercise.slide_id}
      hotspots={hotspots ?? []}
      cellTypes={cellTypes ?? []}
    />
  );
}
