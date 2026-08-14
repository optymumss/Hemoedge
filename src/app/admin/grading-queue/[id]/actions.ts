"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreAnswer } from "@/lib/quiz/scoring";
import { getModulePassThreshold, CASE_PASS_THRESHOLD } from "@/lib/quiz/pass-threshold";
import { checkAndIssueCertificates } from "@/lib/quiz/certificates";

export async function gradeAttempt(formData: FormData): Promise<void> {
  const attemptId = String(formData.get("attempt_id") ?? "");
  if (!attemptId) return;

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, user_id, module_id, case_id, answers")
    .eq("id", attemptId)
    .single();

  if (!attempt) return;

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_type, correct_choice_id, correct_choice_ids")
    .eq(attempt.module_id ? "module_id" : "case_id", attempt.module_id ?? attempt.case_id ?? "");

  if (!questions || questions.length === 0) return;

  const answers = (attempt.answers as Record<string, string>) ?? {};
  const manualGrades: Record<string, boolean> = {};
  let correctCount = 0;

  for (const q of questions) {
    if (q.question_type === "short_answer") {
      const graded = formData.get(`grade_${q.id}`) === "correct";
      manualGrades[q.id] = graded;
      if (graded) correctCount += 1;
    } else if (scoreAnswer(q, answers[q.id] ?? "") === true) {
      correctCount += 1;
    }
  }

  const score = Math.round((correctCount / questions.length) * 100);
  const passThreshold = attempt.module_id
    ? await getModulePassThreshold(supabase, attempt.module_id)
    : CASE_PASS_THRESHOLD;
  const passed = score >= passThreshold;

  await supabase
    .from("quiz_attempts")
    .update({ manual_grades: manualGrades, score, passed, pending_manual_grading: false })
    .eq("id", attemptId);

  if (attempt.module_id) {
    await checkAndIssueCertificates(supabase, attempt.user_id, attempt.module_id);
    revalidatePath(`/app/modules/${attempt.module_id}`);
  }
  if (attempt.case_id) revalidatePath(`/app/cases/${attempt.case_id}`);

  revalidatePath("/admin/grading-queue");
  redirect("/admin/grading-queue");
}
