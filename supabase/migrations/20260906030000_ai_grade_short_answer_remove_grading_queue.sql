-- Short-answer quiz questions are now graded by AI (gradeShortAnswers) at
-- submission time, immediately, instead of sitting in a manual Grading
-- Queue for a content manager/super admin/org admin to review. Attempts are
-- never left in a "pending" state, so the pending-scoped policies and column
-- are no longer needed.
drop policy if exists "quiz_attempts: content staff can read pending grading" on public.quiz_attempts;
drop policy if exists "quiz_attempts: content staff can grade pending attempts" on public.quiz_attempts;

alter table public.quiz_attempts drop column pending_manual_grading;
alter table public.quiz_attempts rename column manual_grades to ai_grades;

comment on column public.quiz_attempts.ai_grades is
  'Per-question correct/incorrect verdicts for short_answer questions, produced by AI grading at submission time.';

-- The model answer is now required for short_answer questions since it's
-- what the AI grades the learner's free text against (still optional for
-- other question types, where it's just extra context shown to the learner).
alter table public.quiz_questions
  add constraint quiz_questions_short_answer_requires_model_answer
  check (question_type <> 'short_answer' or model_answer is not null);
