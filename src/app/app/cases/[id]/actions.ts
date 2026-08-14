"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { computeAttempt } from "@/lib/quiz/score-attempt";

export type FormState = { error?: string } | undefined;

export async function submitQuizAttempt(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const caseId = String(formData.get("case_id") ?? "");
  if (!caseId) return { error: "Missing case." };

  if (await getActiveImpersonation()) {
    return { error: "Quiz submission is disabled while viewing as another user." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_type, correct_choice_id, correct_choice_ids")
    .eq("case_id", caseId);

  if (!questions || questions.length === 0) {
    return { error: "No questions to score." };
  }

  const { answers, score, passed, pendingManualGrading } = computeAttempt(questions, formData);

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    case_id: caseId,
    score,
    passed,
    answers,
    pending_manual_grading: pendingManualGrading,
  });

  if (error) return { error: error.message };

  revalidatePath(`/app/cases/${caseId}`);
  return undefined;
}
