import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId, getActiveImpersonation } from "@/lib/auth/impersonation";
import { getQuestionImageUrls } from "@/lib/quiz/question-image-urls";
import { QuizReview } from "@/components/quiz-review";
import { MediaPlayer } from "@/components/media-player";
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
    .select("id, title, level, status, description, audio_path, audio_transcript, video_path")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found or not yet published.</p>;
  }

  const [{ data: questions }, { data: lessons }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question_text, question_type, choices, feature_id, features(image_path)")
      .eq("module_id", id)
      .order("position"),
    supabase
      .from("lessons")
      .select("id, title, body, slide_id, audio_path, audio_transcript, video_path")
      .eq("module_id", id)
      .order("position"),
  ]);
  const questionImageUrls = await getQuestionImageUrls(supabase, questions ?? []);

  const userId = await getEffectiveUserId();
  const impersonation = await getActiveImpersonation();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("score, passed, answers, pending_manual_grading, manual_grades")
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
        .select(
          "id, question_text, question_type, choices, correct_choice_id, correct_choice_ids, model_answer, feature_id, features(image_path)",
        )
        .eq("module_id", id)
        .order("position")
    : { data: null };
  const reviewImageUrls = reviewQuestions ? await getQuestionImageUrls(supabase, reviewQuestions) : new Map();

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

      {(module_.audio_path || module_.video_path) && (
        <div className="mt-4">
          <MediaPlayer
            audioUrl={module_.audio_path}
            audioTranscript={module_.audio_transcript}
            videoUrl={module_.video_path}
          />
        </div>
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
              moduleId={module_.id}
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
          No quiz has been added to this module yet.
        </p>
      )}
    </div>
  );
}
