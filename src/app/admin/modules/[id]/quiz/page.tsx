import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "./question-form";
import { deleteQuestion } from "./actions";
import { QUESTION_TYPE_LABEL, type QuestionType } from "@/lib/quiz/types";

export default async function ModuleQuestionsPage({
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
    .single();

  const [{ data: questions }, { data: features }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select(
        "id, question_text, question_type, choices, correct_choice_id, correct_choice_ids, model_answer, feature_id, features(title, image_path)",
      )
      .eq("module_id", id)
      .order("position"),
    supabase.from("features").select("id, title").not("image_path", "is", null).order("title"),
  ]);

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found.</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Quiz</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Knowledge check for this module — single/multi-select, true/false, image match, or short
        answer questions.
      </p>

      <div className="mt-6 rounded-lg border border-line p-4">
        <QuestionForm moduleId={module_.id} features={features ?? []} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(questions ?? []).map((q, i) => {
          const choices = q.choices as { id: string; text: string }[];
          const correctIds =
            q.question_type === "multi_select"
              ? new Set((q.correct_choice_ids as string[] | null) ?? [])
              : new Set([q.correct_choice_id].filter(Boolean));
          return (
            <div key={q.id} className="rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium">
                  {i + 1}. {q.question_text}{" "}
                  <span className="text-xs font-normal text-ink-faint">
                    ({QUESTION_TYPE_LABEL[q.question_type as QuestionType] ?? q.question_type})
                  </span>
                </p>
                <form action={deleteQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="module_id" value={module_.id} />
                  <button type="submit" className="text-xs text-danger underline">
                    Delete
                  </button>
                </form>
              </div>
              {q.question_type === "image_match" && q.features?.title && (
                <p className="mt-1 text-xs text-ink-faint">Image: {q.features.title}</p>
              )}
              {q.question_type === "short_answer" ? (
                <p className="mt-2 text-xs text-ink-faint">
                  Free-text response — graded manually from the Grading Queue.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-dim">
                  {choices.map((c) => (
                    <li key={c.id} className={correctIds.has(c.id) ? "font-medium text-success-soft-ink" : ""}>
                      {c.id.toUpperCase()}. {c.text}
                      {correctIds.has(c.id) ? " ✓" : ""}
                    </li>
                  ))}
                </ul>
              )}
              {q.model_answer && (
                <p className="mt-2 text-xs text-ink-faint">Model answer: {q.model_answer}</p>
              )}
            </div>
          );
        })}
        {(questions ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-ink-faint">No questions yet.</p>
        )}
      </div>
    </div>
  );
}
