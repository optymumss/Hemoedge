-- Site Settings CMS: a singleton row (fixed id, seeded below) holding the
-- marketing site's logo text and one shared nav/footer link list. No
-- singleton-enforcement trigger -- this table only ever has one editor
-- (super_admin) and one row by convention, the same "don't build
-- machinery nobody asked for" simplicity already used for
-- platform_org_summary().
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'HemoEdge',
  nav_links jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, site_name, nav_links) values (
  '00000000-0000-4000-8000-0000000000f1',
  'HemoEdge',
  '[{"label":"Blog","href":"/blog"},{"label":"Team","href":"/team"},{"label":"Contact","href":"/contact"}]'::jsonb
);

alter table public.site_settings enable row level security;

-- Unlike pages/blog_posts (public read gated on status = 'published'),
-- site_settings has no draft/published concept -- it's live config, and
-- the marketing site renders for anonymous visitors, so this is
-- unconditional.
create policy "site_settings: public read"
  on public.site_settings for select
  using (true);

create policy "site_settings: super admin full access"
  on public.site_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
