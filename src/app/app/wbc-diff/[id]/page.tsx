import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";
import type { CategoryCode } from "@/lib/wbc-categories";
import { PracticeExercise } from "./practice-exercise";

export default async function LearnerWbcDiffExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, title, level, instructions, slide_id, reference_differential")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!exercise) {
    return <p className="text-sm text-ink-dim">Exercise not found or not yet published.</p>;
  }

  const userId = await getEffectiveUserId();
  const { data: attempts } = await supabase
    .from("wbc_diff_attempts")
    .select("accuracy_pct, created_at")
    .eq("exercise_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastAttempt = attempts?.[0];

  const referenceDifferential = exercise.reference_differential as Partial<
    Record<CategoryCode, number>
  > | null;

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
        {referenceDifferential ? (
          <PracticeExercise
            exerciseId={exercise.id}
            slideId={exercise.slide_id}
            referenceDifferential={referenceDifferential}
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
