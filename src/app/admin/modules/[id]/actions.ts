"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

export async function addQuestion(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const moduleId = String(formData.get("module_id") ?? "");
  const questionText = String(formData.get("question_text") ?? "").trim();
  const correct = String(formData.get("correct") ?? "");

  const choices = ["a", "b", "c", "d"]
    .map((id) => ({ id, text: String(formData.get(`choice_${id}`) ?? "").trim() }))
    .filter((c) => c.text.length > 0);

  if (!moduleId || !questionText) return { error: "Question text is required." };
  if (choices.length < 2) return { error: "Enter at least two choices." };
  if (!choices.some((c) => c.id === correct)) {
    return { error: "Pick which choice is correct." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("quiz_questions").insert({
    module_id: moduleId,
    question_text: questionText,
    choices,
    correct_choice_id: correct,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/modules/${moduleId}`);
  return undefined;
}

export async function deleteQuestion(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("module_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", id);

  revalidatePath(`/admin/modules/${moduleId}`);
}
