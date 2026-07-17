import { createClient } from "@/lib/supabase/server";
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
    return <p className="text-sm text-neutral-500">Module not found or not yet published.</p>;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, choices")
    .eq("module_id", id)
    .order("position");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, passed")
    .eq("module_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAttempt = attempts?.[0];

  return (
    <div>
      <h1 className="text-xl font-semibold">{module_.title}</h1>
      <p className="mt-1 text-sm capitalize text-neutral-500">{module_.level}</p>

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
      ) : (
        <p className="mt-6 text-sm text-neutral-400">
          No quiz has been added to this module yet.
        </p>
      )}
    </div>
  );
}
