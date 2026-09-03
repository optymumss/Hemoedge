import { createClient } from "@/lib/supabase/server";
import type { CategoryCode } from "@/lib/wbc-categories";
import { ReferenceForm } from "../reference-form";

export default async function ExerciseReferencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, reference_differential")
    .eq("id", id)
    .single();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found.</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Reference differential</h1>
      <div className="mt-6">
        <ReferenceForm
          exerciseId={exercise.id}
          referenceDifferential={
            exercise.reference_differential as Partial<Record<CategoryCode, number>> | null
          }
        />
      </div>
    </div>
  );
}
