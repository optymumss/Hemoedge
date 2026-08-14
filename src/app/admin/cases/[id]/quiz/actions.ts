"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionForm } from "@/lib/quiz/parse-question-form";

export type FormState = { error?: string } | undefined;

export async function addQuestion(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const caseId = String(formData.get("case_id") ?? "");
  if (!caseId) return { error: "Missing case." };

  const parsed = parseQuestionForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("quiz_questions").insert({
    case_id: caseId,
    question_text: parsed.question_text,
    question_type: parsed.question_type,
    choices: parsed.choices,
    correct_choice_id: parsed.correct_choice_id,
    correct_choice_ids: parsed.correct_choice_ids,
    feature_id: parsed.feature_id,
    model_answer: parsed.model_answer,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/cases/${caseId}/quiz`);
  return undefined;
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("case_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", id);

  revalidatePath(`/admin/cases/${caseId}/quiz`);
}
