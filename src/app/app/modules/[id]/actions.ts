"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndIssueCertificates } from "@/lib/quiz/certificates";
import { getActiveImpersonation } from "@/lib/auth/impersonation";
import { computeAttempt } from "@/lib/quiz/score-attempt";
import { getModulePassThreshold } from "@/lib/quiz/pass-threshold";

export type FormState = { error?: string } | undefined;

export async function submitQuizAttempt(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const moduleId = String(formData.get("module_id") ?? "");
  if (!moduleId) return { error: "Missing module." };

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
    .eq("module_id", moduleId);

  if (!questions || questions.length === 0) {
    return { error: "No questions to score." };
  }

  const passThreshold = await getModulePassThreshold(supabase, moduleId);
  const { answers, score, passed, pendingManualGrading } = computeAttempt(
    questions,
    formData,
    passThreshold,
  );

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    module_id: moduleId,
    score,
    passed,
    answers,
    pending_manual_grading: pendingManualGrading,
  });

  if (error) return { error: error.message };

  // Issuing a certificate off a score that's still waiting on manual grading
  // would be premature — the grading queue recomputes and re-checks this
  // once the pending short-answer questions are graded.
  if (!pendingManualGrading) {
    await checkAndIssueCertificates(supabase, user.id, moduleId);
  }

  revalidatePath(`/app/modules/${moduleId}`);
  revalidatePath("/app/competency");
  revalidatePath("/app/certificates");
  return undefined;
}
