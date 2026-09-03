import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import { ClassifyExercise } from "./classify-exercise";

export default async function LearnerCellIdExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from("cell_id_exercises")
    .select("id, title, level, instructions, slide_id")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found or not yet published.</p>;
  }

  // Pins are fetched without cell_type_id (the answer) — scoring re-fetches
  // it server-side, same split as quiz_questions.correct_choice_id.
  const [{ data: pins }, { data: cellTypes }] = await Promise.all([
    supabase
      .from("cell_id_hotspots")
      .select("id, x_pct, y_pct, tolerance_pct")
      .eq("exercise_id", id)
      .order("created_at"),
    supabase.from("cell_types").select("id, name, lineage").order("name"),
  ]);

  const userId = await getEffectiveUserId();
  const { data: attempts } = await supabase
    .from("cell_id_attempts")
    .select("accuracy_pct, created_at")
    .eq("exercise_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastAttempt = attempts?.[0];

  return (
    <div>
      <h1 className="text-xl font-semibold">{exercise.title}</h1>
      <p className="mt-1 text-sm capitalize text-ink-dim">{exercise.level}</p>
      {exercise.instructions && (
        <p className="mt-2 text-sm text-ink-dim">{exercise.instructions}</p>
      )}

      {lastAttempt && (
        <div className="mt-4 rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-dim">
          Last attempt: {lastAttempt.accuracy_pct}%
        </div>
      )}

      <div className="mt-6">
        {pins && pins.length > 0 ? (
          <ClassifyExercise
            exerciseId={exercise.id}
            slideId={exercise.slide_id}
            pins={pins}
            cellTypes={cellTypes ?? []}
          />
        ) : (
          <p className="text-sm text-ink-faint">
            This exercise isn&apos;t ready for practice yet — check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
