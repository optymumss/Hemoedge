import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { CaseSlideViewer } from "./case-slide-viewer";
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
    .select(
      "id, title, level, description, status, slide_id, case_context, lab_values, final_diagnosis, learning_points",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!case_) {
    return <p className="text-sm text-ink-dim">Case study not found or not yet published.</p>;
  }

  const { data: featureLinks } = await supabase
    .from("case_features")
    .select("features(id, title)")
    .eq("case_id", id);

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, choices")
    .eq("case_id", id)
    .order("position");

  const { data: diffExercise } = await supabase
    .from("wbc_diff_exercises")
    .select("id, title")
    .eq("case_id", id)
    .eq("status", "published")
    .maybeSingle();

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
      <p className="mt-1 text-sm capitalize text-ink-dim">{case_.level}</p>
      {case_.description && (
        <p className="mt-4 max-w-2xl text-sm text-ink-dim">{case_.description}</p>
      )}

      {case_.slide_id && (
        <div className="mt-6">
          <CaseSlideViewer slideId={case_.slide_id} />
        </div>
      )}

      {case_.case_context && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Case context</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{case_.case_context}</p>
        </div>
      )}

      {case_.lab_values && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">FBC / lab values</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{case_.lab_values}</p>
        </div>
      )}

      {(featureLinks ?? []).length > 0 && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Related features</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(featureLinks ?? []).map((f) =>
              f.features ? (
                <span
                  key={f.features.id}
                  className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink"
                >
                  {f.features.title}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {case_.final_diagnosis && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Final diagnosis</h2>
          <p className="mt-1 text-sm text-ink-dim">{case_.final_diagnosis}</p>
        </div>
      )}

      {case_.learning_points && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Key learning points</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">{case_.learning_points}</p>
        </div>
      )}

      {diffExercise && (
        <div className="mt-6 max-w-2xl rounded-md border border-line p-3">
          <Link href={`/app/wbc-diff/${diffExercise.id}`} className="text-sm font-medium hover:underline">
            Practice: {diffExercise.title} →
          </Link>
        </div>
      )}

      {lastAttempt && (
        <div
          className={`mt-6 rounded-md px-3 py-2 text-sm ${
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
        <p className="mt-6 text-sm text-ink-faint">
          No quiz has been added to this case study yet.
        </p>
      )}
    </div>
  );
}
