-- Tracks distinct slides a learner has opened, for the learner dashboard's
-- "Slides Reviewed" stat. Deliberately minimal: one row per (user, slide),
-- upserted on view — this counts distinct slides seen, not open-count.

create table public.slide_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  slide_id uuid not null references public.slides (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, slide_id)
);

create index slide_views_user_id_idx on public.slide_views (user_id);
create index slide_views_slide_id_idx on public.slide_views (slide_id);

alter table public.slide_views enable row level security;

create policy "slide_views: super admin full access"
  on public.slide_views for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "slide_views: learner can record and read their own"
  on public.slide_views for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
