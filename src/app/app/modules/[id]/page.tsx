import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { QuizForm } from "./quiz-form";
import { LessonTree } from "./lesson-tree";

export default async function LearnerModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: module_ } = await supabase
    .from("modules")
    .select("id, title, level, status, description")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found or not yet published.</p>;
  }

  const [{ data: questions }, { data: lessons }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question_text, choices")
      .eq("module_id", id)
      .order("position"),
    supabase
      .from("lessons")
      .select("id, title, body, slide_id")
      .eq("module_id", id)
      .order("position"),
  ]);

  const userId = await getEffectiveUserId();
  const impersonation = await getActiveImpersonation();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, passed, answers")
    .eq("module_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAttempt = attempts?.[0];

  // Only fetched once the learner has an attempt on record — the answer key
  // (correct_choice_id, model_answer) must never be readable before that.
  const { data: reviewQuestions } = lastAttempt
    ? await supabase
        .from("quiz_questions")
        .select("id, question_text, choices, correct_choice_id, model_answer")
        .eq("module_id", id)
        .order("position")
    : { data: null };

  const { data: diffExercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, title")
    .eq("module_id", id)
    .eq("status", "published")
    .maybeSingle();

  return (
    <div>
      <h1 className="text-xl font-semibold">{module_.title}</h1>
      <p className="mt-1 text-sm capitalize text-ink-dim">{module_.level}</p>
      {module_.description && (
        <p className="mt-2 text-sm text-ink-dim">{module_.description}</p>
      )}

      {(lessons ?? []).length > 0 && (
        <div className="mt-6">
          <LessonTree lessons={lessons ?? []} />
        </div>
      )}

      {diffExercise && (
        <div className="mt-4 max-w-2xl rounded-md border border-line p-3">
          <Link href={`/app/wbc-diff/${diffExercise.id}`} className="text-sm font-medium hover:underline">
            Practice: {diffExercise.title} →
          </Link>
        </div>
      )}

      {lastAttempt && (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            lastAttempt.passed ? "bg-success-soft text-success-soft-ink" : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          Last attempt: {lastAttempt.score}% — {lastAttempt.passed ? "Passed" : "Not passed yet"}
        </div>
      )}

      {lastAttempt && (reviewQuestions ?? []).length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {(reviewQuestions ?? []).map((q, i) => {
            const choices = q.choices as { id: string; text: string }[];
            const yourAnswer = (lastAttempt.answers as Record<string, string> | null)?.[q.id];
            const wasCorrect = yourAnswer === q.correct_choice_id;
            return (
              <div key={q.id} className="rounded-lg border border-line p-4">
                <p className="text-sm font-medium">
                  {i + 1}. {q.question_text}{" "}
                  <span className={wasCorrect ? "text-success-soft-ink" : "text-danger"}>
                    {wasCorrect ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-dim">
                  {choices.map((c) => (
                    <li
                      key={c.id}
                      className={
                        c.id === q.correct_choice_id
                          ? "font-medium text-success-soft-ink"
                          : c.id === yourAnswer
                            ? "text-danger"
                            : ""
                      }
                    >
                      {c.id.toUpperCase()}. {c.text}
                      {c.id === q.correct_choice_id ? " ✓" : c.id === yourAnswer ? " (your answer)" : ""}
                    </li>
                  ))}
                </ul>
                {q.model_answer && (
                  <p className="mt-2 text-sm text-ink-dim">
                    <span className="font-medium text-ink">Model answer: </span>
                    {q.model_answer}
                  </p>
                )}
              </div>
            );
          })}
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
