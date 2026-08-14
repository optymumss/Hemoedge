export type ReviewQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  choices: { id: string; text: string }[];
  correct_choice_id: string | null;
  correct_choice_ids: string[] | null;
  model_answer: string | null;
  imageUrl?: string | null;
};

/** Shared post-submit review, used by both case and module quiz pages. */
export function QuizReview({
  questions,
  answers,
  manualGrades,
}: {
  questions: ReviewQuestion[];
  answers: Record<string, string> | null;
  manualGrades: Record<string, boolean> | null;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {questions.map((q, i) => {
        const yourAnswer = answers?.[q.id] ?? "";
        let verdict: "correct" | "incorrect" | "pending";
        if (q.question_type === "short_answer") {
          const grade = manualGrades?.[q.id];
          verdict = grade === true ? "correct" : grade === false ? "incorrect" : "pending";
        } else if (q.question_type === "multi_select") {
          const correct = new Set(q.correct_choice_ids ?? []);
          const chosen = new Set(yourAnswer.split(",").filter(Boolean));
          verdict =
            correct.size > 0 && correct.size === chosen.size && Array.from(chosen).every((id) => correct.has(id))
              ? "correct"
              : "incorrect";
        } else {
          verdict = yourAnswer === q.correct_choice_id ? "correct" : "incorrect";
        }

        return (
          <div key={q.id} className="rounded-lg border border-line p-4">
            <p className="text-sm font-medium">
              {i + 1}. {q.question_text}{" "}
              <span
                className={
                  verdict === "correct"
                    ? "text-success-soft-ink"
                    : verdict === "incorrect"
                      ? "text-danger"
                      : "text-warning-soft-ink"
                }
              >
                {verdict === "correct" ? "✓ Correct" : verdict === "incorrect" ? "✗ Incorrect" : "Pending review"}
              </span>
            </p>
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.imageUrl}
                alt=""
                className="mt-2 max-h-48 rounded-md border border-line object-contain"
              />
            )}
            {q.question_type === "short_answer" ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-dim">
                <span className="font-medium text-ink">Your answer: </span>
                {yourAnswer || "—"}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-dim">
                {q.choices.map((c) => {
                  const isCorrectChoice =
                    q.question_type === "multi_select"
                      ? (q.correct_choice_ids ?? []).includes(c.id)
                      : c.id === q.correct_choice_id;
                  const isChosen =
                    q.question_type === "multi_select"
                      ? yourAnswer.split(",").includes(c.id)
                      : c.id === yourAnswer;
                  return (
                    <li
                      key={c.id}
                      className={isCorrectChoice ? "font-medium text-success-soft-ink" : isChosen ? "text-danger" : ""}
                    >
                      {c.id.toUpperCase()}. {c.text}
                      {isCorrectChoice ? " ✓" : isChosen ? " (your answer)" : ""}
                    </li>
                  );
                })}
              </ul>
            )}
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
  );
}
