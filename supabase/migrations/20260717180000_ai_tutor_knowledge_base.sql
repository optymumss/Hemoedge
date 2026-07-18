-- Gives modules and cases a describable body of text (beyond just a title)
-- so the AI Tutor's retrieval has more than Feature definitions to draw on.

alter table public.modules add column description text;
alter table public.cases add column description text;
