"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndIssueCertificates } from "@/lib/quiz/certificates";

export type FormState = { error?: string } | undefined;

export async function submitQuizAttempt(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const moduleId = String(formData.get("module_id") ?? "");
  if (!moduleId) return { error: "Missing module." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, correct_choice_id")
    .eq("module_id", moduleId);

  if (!questions || questions.length === 0) {
    return { error: "No questions to score." };
  }

  const answers: Record<string, string> = {};
  let correctCount = 0;
  for (const q of questions) {
    const chosen = String(formData.get(`q_${q.id}`) ?? "");
    answers[q.id] = chosen;
    if (chosen === q.correct_choice_id) correctCount += 1;
  }

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= 70;

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: user.id,
    module_id: moduleId,
    score,
    passed,
    answers,
  });

  if (error) return { error: error.message };

  await checkAndIssueCertificates(supabase, user.id, moduleId);

  revalidatePath(`/app/modules/${moduleId}`);
  revalidatePath("/app/competency");
  revalidatePath("/app/certificates");
  return undefined;
}
