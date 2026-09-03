"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { CATEGORIES, type CategoryCode } from "@/lib/wbc-categories";

export type SubmitResult = { accuracyPct: number } | { error: string };

/**
 * Scores a learner's free-tally differential against the exercise's
 * reference differential (re-fetched server-side — never trust the client
 * for the answer key) — average absolute deviation per category, converted
 * to an accuracy score, rather than the old per-pin correct/incorrect
 * count from the retired hotspot-classification version of this exercise.
 */
export async function submitAttempt(
  exerciseId: string,
  counts: Record<CategoryCode, number>,
): Promise<SubmitResult> {
  if (await getActiveImpersonation()) {
    return { error: "Submitting is disabled while viewing as another user." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: exercise } = await supabase
    .from("wbc_diff_exercises")
    .select("reference_differential")
    .eq("id", exerciseId)
    .single();

  const reference = exercise?.reference_differential as Partial<Record<CategoryCode, number>> | null;
  if (!reference) {
    return { error: "This exercise isn't fully configured yet." };
  }

  let totalDeviation = 0;
  for (const { code } of CATEGORIES) {
    const learnerValue = counts[code] ?? 0;
    const referenceValue = reference[code] ?? 0;
    totalDeviation += Math.abs(learnerValue - referenceValue);
  }
  const avgDeviation = totalDeviation / CATEGORIES.length;
  const accuracyPct = Math.max(0, Math.min(100, Math.round(100 - avgDeviation)));

  const { error } = await supabase.from("wbc_diff_attempts").insert({
    exercise_id: exerciseId,
    user_id: user.id,
    results: counts,
    accuracy_pct: accuracyPct,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/wbc-diff/${exerciseId}`);
  return { accuracyPct };
}
