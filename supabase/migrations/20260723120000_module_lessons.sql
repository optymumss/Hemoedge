-- Module lessons: ordered content units within a module, each optionally
-- linking a slide for an embedded WSI view. Visibility mirrors
-- quiz_questions — gated by the parent module's own published status
-- rather than a separate review workflow.

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  body text,
  slide_id uuid references public.slides (id) on delete set null,
  position integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_module_id_idx on public.lessons (module_id);

alter table public.lessons enable row level security;

create policy "lessons: super admin full access"
  on public.lessons for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "lessons: content manager can manage their module's lessons"
  on public.lessons for all
  using (
    exists (
      select 1 from public.modules
      where modules.id = lessons.module_id and modules.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.modules
      where modules.id = lessons.module_id and modules.created_by = auth.uid()
    )
  );

create policy "lessons: read for published modules"
  on public.lessons for select
  using (
    exists (
      select 1 from public.modules
      where modules.id = lessons.module_id and modules.status = 'published'
    )
  );
