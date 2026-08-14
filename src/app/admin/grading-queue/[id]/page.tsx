import { createClient } from "@/lib/supabase/server";
import { gradeAttempt } from "./actions";

export default async function GradeAttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, answers, module_id, case_id, profiles(full_name, email), modules(title), cases(title)")
    .eq("id", id)
    .single();

  if (!attempt) {
    return <p className="text-sm text-ink-dim">Attempt not found.</p>;
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, question_type, model_answer")
    .eq(attempt.module_id ? "module_id" : "case_id", attempt.module_id ?? attempt.case_id ?? "")
    .order("position");

  const shortAnswerQuestions = (questions ?? []).filter((q) => q.question_type === "short_answer");
  const answers = (attempt.answers as Record<string, string>) ?? {};

  return (
    <div>
      <h1 className="text-xl font-semibold">
        Grade — {attempt.profiles?.full_name || attempt.profiles?.email || "Learner"}
      </h1>
      <p className="mt-1 text-sm text-ink-dim">{attempt.modules?.title ?? attempt.cases?.title}</p>

      <form action={gradeAttempt} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="attempt_id" value={attempt.id} />
        {shortAnswerQuestions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-line p-4">
            <p className="text-sm font-medium">
              {i + 1}. {q.question_text}
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-sunken p-2 text-sm text-ink-dim">
              {answers[q.id] || "(no answer)"}
            </p>
            {q.model_answer && (
              <p className="mt-2 text-xs text-ink-faint">Grading guidance: {q.model_answer}</p>
            )}
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`grade_${q.id}`} value="correct" required /> Correct
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`grade_${q.id}`} value="incorrect" /> Incorrect
              </label>
            </div>
          </div>
        ))}
        {shortAnswerQuestions.length === 0 && (
          <p className="text-sm text-ink-faint">No short-answer questions on this attempt.</p>
        )}
        <button
          type="submit"
          className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          Submit grades
        </button>
      </form>
    </div>
  );
}
