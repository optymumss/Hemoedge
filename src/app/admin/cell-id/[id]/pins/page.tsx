import { createClient } from "@/lib/supabase/server";
import { PinAnnotator } from "./pin-annotator";

export default async function ExercisePinsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from("cell_id_exercises")
    .select("id, slide_id")
    .eq("id", id)
    .single();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found.</p>;
  }

  const [{ data: pins }, { data: cellTypes }] = await Promise.all([
    supabase
      .from("cell_id_hotspots")
      .select("id, x_pct, y_pct, cell_type_id, cell_types(name)")
      .eq("exercise_id", id)
      .order("created_at"),
    supabase.from("cell_types").select("id, name, lineage").order("name"),
  ]);

  return (
    <PinAnnotator
      exerciseId={exercise.id}
      slideId={exercise.slide_id}
      pins={pins ?? []}
      cellTypes={cellTypes ?? []}
    />
  );
}
