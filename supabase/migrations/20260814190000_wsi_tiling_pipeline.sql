-- Tiling status is deliberately separate from `status` (the content-review
-- workflow enum draft/in_review/changes_requested/published) -- they track
-- unrelated things and the name collision was flagged and avoided up front.
alter table public.slides
  add column tiling_status text not null default 'none',
  add column tile_manifest_url text;

alter table public.slides
  add constraint slides_tiling_status_check
  check (tiling_status in ('none', 'queued', 'processing', 'ready', 'failed'));

-- One job row per tiling attempt gives a real retry/attempt history instead
-- of just overwriting a single status field on the slide.
create table public.tiling_jobs (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  attempts integer not null default 0,
  error text,
  sandbox_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiling_jobs enable row level security;
create index tiling_jobs_slide_id_idx on public.tiling_jobs(slide_id);

-- Content managers/super admins can see job status for slides they can
-- already manage; the callback route uses the service-role key (bypasses
-- RLS entirely), so it needs no policy of its own here.
create policy "tiling_jobs: content staff can read"
  on public.tiling_jobs for select
  using (
    is_super_admin()
    or exists (
      select 1 from public.slides
      where slides.id = tiling_jobs.slide_id
        and can_manage_content('slides', slides.id, slides.created_by)
    )
  );

create policy "tiling_jobs: super admin full access"
  on public.tiling_jobs for all
  using (is_super_admin())
  with check (is_super_admin());
