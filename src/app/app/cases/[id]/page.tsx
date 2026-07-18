import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { QuizForm } from "./quiz-form";

export default async function LearnerCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: case_ } = await supabase
    .from("cases")
    .select("id, title, level, description, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!case_) {
    return <p className="text-sm text-neutral-500">Case not found or not yet published.</p>;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, choices")
    .eq("case_id", id)
    .order("position");

  const userId = await getEffectiveUserId();
  const impersonation = await getActiveImpersonation();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, passed")
    .eq("case_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAttempt = attempts?.[0];

  return (
    <div>
      <h1 className="text-xl font-semibold">{case_.title}</h1>
      <p className="mt-1 text-sm capitalize text-neutral-500">{case_.level}</p>
      {case_.description && (
        <p className="mt-4 max-w-2xl text-sm text-neutral-600">{case_.description}</p>
      )}

      {lastAttempt && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            lastAttempt.passed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          Last attempt: {lastAttempt.score}% — {lastAttempt.passed ? "Passed" : "Not passed yet"}
        </div>
      )}

      {(questions ?? []).length > 0 ? (
        impersonation ? (
          <p className="mt-6 text-sm text-neutral-400">
            Quiz submission is disabled while viewing as another user.
          </p>
        ) : (
          <div className="mt-6">
            <QuizForm
              caseId={case_.id}
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
        <p className="mt-6 text-sm text-neutral-400">
          No quiz has been added to this case yet.
        </p>
      )}
    </div>
  );
}
