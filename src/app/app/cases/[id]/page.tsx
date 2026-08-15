import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { getQuestionImageUrls } from "@/lib/quiz/question-image-urls";
import { QuizReview } from "@/components/quiz-review";
import { MediaPlayer } from "@/components/media-player";
import { CaseSlideViewer } from "./case-slide-viewer";
import { QuizForm } from "./quiz-form";

const ESCALATION_LABEL: Record<string, string> = {
  routine: "Routine",
  senior_review: "Senior review",
  urgent: "Urgent escalation",
};

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
      "id, title, level, description, status, slide_id, case_context, lab_values, final_diagnosis, learning_points, case_category, escalation_decision, suggested_report_comment, audio_path, audio_transcript, video_path",
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

  const { data: moduleLinks } = await supabase
    .from("case_modules")
    .select("modules(id, title)")
    .eq("case_id", id);

  const { data: additionalSlides } = await supabase
    .from("case_slides")
    .select("slides(id, title)")
    .eq("case_id", id);

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text, question_type, choices, feature_id, features(image_path)")
    .eq("case_id", id)
    .order("position");
  const questionImageUrls = await getQuestionImageUrls(supabase, questions ?? []);

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
    .select("score, passed, answers, pending_manual_grading, manual_grades")
    .eq("case_id", id)
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastAttempt = attempts?.[0];

  // Only fetched once the learner has an attempt on record — the answer key
  // (correct_choice_id, model_answer) must never be readable before that.
  const { data: reviewQuestions } = lastAttempt
    ? await supabase
        .from("quiz_questions")
        .select(
          "id, question_text, question_type, choices, correct_choice_id, correct_choice_ids, model_answer, feature_id, features(image_path)",
        )
        .eq("case_id", id)
        .order("position")
    : { data: null };
  const reviewImageUrls = reviewQuestions ? await getQuestionImageUrls(supabase, reviewQuestions) : new Map();

  return (
    <div>
      <h1 className="text-xl font-semibold">{case_.title}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm capitalize text-ink-dim">
        {case_.level}
        {case_.case_category && (
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] normal-case text-ink">
            {case_.case_category}
          </span>
        )}
      </p>
      {case_.description && (
        <p className="mt-4 max-w-2xl text-sm text-ink-dim">{case_.description}</p>
      )}

      {case_.slide_id && (
        <div className="mt-6">
          <CaseSlideViewer slideId={case_.slide_id} />
        </div>
      )}

      {(additionalSlides ?? []).map((s) =>
        s.slides ? (
          <div key={s.slides.id} className="mt-4">
            <h2 className="text-sm font-semibold">{s.slides.title}</h2>
            <div className="mt-2">
              <CaseSlideViewer slideId={s.slides.id} />
            </div>
          </div>
        ) : null,
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

      {(case_.audio_path || case_.video_path) && (
        <div className="mt-6 max-w-2xl">
          <MediaPlayer
            audioUrl={case_.audio_path}
            audioTranscript={case_.audio_transcript}
            videoUrl={case_.video_path}
          />
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

      {case_.escalation_decision && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Escalation decision</h2>
          <p className="mt-1 text-sm text-ink-dim">
            {ESCALATION_LABEL[case_.escalation_decision] ?? case_.escalation_decision}
          </p>
        </div>
      )}

      {case_.suggested_report_comment && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Suggested report comment</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">
            {case_.suggested_report_comment}
          </p>
        </div>
      )}

      {(moduleLinks ?? []).length > 0 && (
        <div className="mt-6 max-w-2xl">
          <h2 className="text-sm font-semibold">Related modules</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {(moduleLinks ?? []).map((m) =>
              m.modules ? (
                <Link
                  key={m.modules.id}
                  href={`/app/modules/${m.modules.id}`}
                  className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink hover:underline"
                >
                  {m.modules.title}
                </Link>
              ) : null,
            )}
          </div>
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
            lastAttempt.pending_manual_grading
              ? "bg-warning-soft text-warning-soft-ink"
              : lastAttempt.passed
                ? "bg-success-soft text-success-soft-ink"
                : "bg-warning-soft text-warning-soft-ink"
          }`}
        >
          {lastAttempt.pending_manual_grading
            ? "Last attempt: pending review of your short-answer responses"
            : `Last attempt: ${lastAttempt.score}% — ${lastAttempt.passed ? "Passed" : "Not passed yet"}`}
        </div>
      )}

      {lastAttempt && (reviewQuestions ?? []).length > 0 && (
        <QuizReview
          questions={(reviewQuestions ?? []).map((q) => ({
            ...q,
            choices: q.choices as { id: string; text: string }[],
            correct_choice_ids: q.correct_choice_ids as string[] | null,
            imageUrl: reviewImageUrls.get(q.id) ?? null,
          }))}
          answers={lastAttempt.answers as Record<string, string> | null}
          manualGrades={lastAttempt.manual_grades as Record<string, boolean> | null}
        />
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
              questions={(questions ?? []).map((q) => ({
                id: q.id,
                question_text: q.question_text,
                question_type: q.question_type,
                choices: q.choices as { id: string; text: string }[],
                imageUrl: questionImageUrls.get(q.id) ?? null,
              }))}
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
