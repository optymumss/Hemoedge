"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionForm } from "@/lib/quiz/parse-question-form";

export type FormState = { error?: string } | undefined;

export async function addQuestion(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const moduleId = String(formData.get("module_id") ?? "");
  if (!moduleId) return { error: "Missing module." };

  const parsed = parseQuestionForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("quiz_questions").insert({
    module_id: moduleId,
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

  revalidatePath(`/admin/modules/${moduleId}/quiz`);
  return undefined;
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", id);

  revalidatePath(`/admin/modules/${moduleId}/quiz`);
}
