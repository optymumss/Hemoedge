import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { QuizForm } from "./quiz-form";

export default async function LearnerModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: module_ } = await supabase
    .from("modules")
    .select("id, title, level, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found or not yet published.</p>;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, choices")
    .eq("module_id", id)
    .order("position");

  const userId = await getEffectiveUserId();
  const impersonation = await getActiveImpersonation();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, passed")
    .eq("module_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAttempt = attempts?.[0];

  return (
    <div>
      <h1 className="text-xl font-semibold">{module_.title}</h1>
      <p className="mt-1 text-sm capitalize text-ink-dim">{module_.level}</p>

      {lastAttempt && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            lastAttempt.passed ? "bg-success-soft text-success-soft-ink" : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          Last attempt: {lastAttempt.score}% — {lastAttempt.passed ? "Passed" : "Not passed yet"}
        </div>
      )}

      {(questions ?? []).length > 0 ? (
        impersonation ? (
          <p className="mt-6 text-sm text-ink-faint">
            Quiz submission is disabled while viewing as another user.
          </p>
        ) : (
          <div className="mt-6">
            <QuizForm
              moduleId={module_.id}
              questions={
                (questions ?? []) as unknown as {
                  id: string;
                  question_text: string;
                  choices: { id: string; text: string }[];
                }[]
              }
            />
          </div>
        )
      ) : (
        <p className="mt-6 text-sm text-ink-faint">
          No quiz has been added to this module yet.
        </p>
      )}
    </div>
  );
}
