"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";

export type SubmitResult =
  | { accuracyPct: number; correctness: Record<string, boolean> }
  | { error: string };

/**
 * Re-fetches pins server-side (with cell_type_id, the answer) to score —
 * same "trust the client for nothing but the render" split as the module
 * quiz's submitQuizAttempt.
 */
export async function submitAttempt(
  exerciseId: string,
  answers: Record<string, string>,
): Promise<SubmitResult> {
  if (await getActiveImpersonation()) {
    return { error: "Submitting is disabled while viewing as another user." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: pins } = await supabase
    .from("cell_id_hotspots")
    .select("id, cell_type_id")
    .eq("exercise_id", exerciseId);

  if (!pins || pins.length === 0) {
    return { error: "This exercise has no pins yet." };
  }

  const correctness: Record<string, boolean> = {};
  let correctCount = 0;
  const byCellType: Record<string, { correct: number; total: number }> = {};

  for (const p of pins) {
    const isCorrect = answers[p.id] === p.cell_type_id;
    correctness[p.id] = isCorrect;
    if (isCorrect) correctCount += 1;

    const bucket = byCellType[p.cell_type_id] ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (isCorrect) bucket.correct += 1;
    byCellType[p.cell_type_id] = bucket;
  }

  const accuracyPct = Math.round((correctCount / pins.length) * 100);

  const { error } = await supabase.from("cell_id_attempts").insert({
    exercise_id: exerciseId,
    user_id: user.id,
    results: byCellType,
    accuracy_pct: accuracyPct,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/cell-id/${exerciseId}`);
  return { accuracyPct, correctness };
}
