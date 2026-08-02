-- "Curricula" only had Title, Level, and Pass Threshold — missing most of
-- the fields a Learning Pathway needs (the UI-facing rename to "Learning
-- Pathways" happens in application code only; the table/route/content_type
-- discriminator strings stay "curricula"/"curriculum" since those are load-
-- bearing across content_reviews, org_catalog_selections, and content_scopes).
alter table public.curricula add column description text;
alter table public.curricula add column pathway_type text
  check (pathway_type in ('full_pathway', 'cpd_pathway', 'specialist_pathway', 'assessment_preparation'));
alter table public.curricula add column learning_outcomes text;
alter table public.curricula add column certificate_awarded boolean not null default true;
alter table public.curricula add column certificate_title text;
alter table public.curricula add column cpd_points integer not null default 0 check (cpd_points >= 0);
alter table public.curricula add column estimated_completion_minutes integer check (estimated_completion_minutes > 0);
alter table public.curricula add column version integer not null default 1;
