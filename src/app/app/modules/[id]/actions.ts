"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndIssueCertificates } from "@/lib/quiz/certificates";
import { getActiveImpersonation } from "@/lib/auth/impersonation";

export type FormState = { error?: string } | undefined;

const DEFAULT_PASS_THRESHOLD = 70;

/**
 * A module can belong to zero, one, or several curricula, each with its own
 * pass_threshold — there's no single "correct" threshold in the ambiguous
 * cases, so this only applies a curriculum's threshold when the module
 * belongs to exactly one; otherwise it falls back to the platform default.
 * Certificate issuance (checkAndIssueCertificates) separately re-checks the
 * raw score against each linked curriculum's own threshold, so that part
 * already accounts for multi-curriculum membership correctly regardless of
 * what's stored here.
 */
async function getPassThreshold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  moduleId: string,
): Promise<number> {
  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id")
    .eq("module_id", moduleId);

  if (!links || links.length !== 1) return DEFAULT_PASS_THRESHOLD;

  const { data: curriculum } = await supabase
    .from("curricula")
    .select("pass_threshold")
    .eq("id", links[0].curriculum_id)
    .single();

  return curriculum?.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
}

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
  const passed = score >= (await getPassThreshold(supabase, moduleId));

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
