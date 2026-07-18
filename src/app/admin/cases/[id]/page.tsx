import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "./question-form";
import { deleteQuestion } from "./actions";

export default async function CaseQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: case_ } = await supabase
    .from("cases")
    .select("id, title, level, status")
    .eq("id", id)
    .single();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, choices, correct_choice_id")
    .eq("case_id", id)
    .order("position");

  if (!case_) {
    return <p className="text-sm text-neutral-500">Case not found.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{case_.title} — Quiz</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Multiple-choice knowledge check for this case.
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <QuestionForm caseId={case_.id} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(questions ?? []).map((q, i) => {
          const choices = q.choices as { id: string; text: string }[];
          return (
            <div key={q.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium">
                  {i + 1}. {q.question_text}
                </p>
                <form action={deleteQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="case_id" value={case_.id} />
                  <button type="submit" className="text-xs text-red-600 underline">
                    Delete
                  </button>
                </form>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-600">
                {choices.map((c) => (
                  <li key={c.id} className={c.id === q.correct_choice_id ? "font-medium text-green-700" : ""}>
                    {c.id.toUpperCase()}. {c.text}
                    {c.id === q.correct_choice_id ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {(questions ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-400">No questions yet.</p>
        )}
      </div>
    </div>
  );
}
