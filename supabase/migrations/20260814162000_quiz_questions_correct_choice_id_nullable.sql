-- correct_choice_id was NOT NULL from when every question was single_choice.
-- multi_select uses correct_choice_ids instead, and short_answer has no
-- choice-based answer key at all, so both legitimately need it null.
alter table public.quiz_questions alter column correct_choice_id drop not null;
