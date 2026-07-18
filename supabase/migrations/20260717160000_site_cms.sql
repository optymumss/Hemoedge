-- Site CMS: marketing site pages, blog, testimonials, associates, and
-- inbound contact enquiries. Authored by Super Admins; published rows are
-- readable by anyone (including anonymous visitors) so a future public
-- marketing site can render them. Enquiries are the exception — anyone can
-- submit one, but only a Super Admin can read them back.

create type public.page_type as enum ('homepage', 'about', 'contact', 'pilot', 'custom');

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  type public.page_type not null default 'custom',
  content text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_title text,
  quote text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.associates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.pages enable row level security;
alter table public.blog_posts enable row level security;
alter table public.testimonials enable row level security;
alter table public.associates enable row level security;
alter table public.enquiries enable row level security;

create policy "pages: super admin full access" on public.pages for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "pages: public read published" on public.pages for select
  using (status = 'published');

create policy "blog_posts: super admin full access" on public.blog_posts for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "blog_posts: public read published" on public.blog_posts for select
  using (status = 'published');

create policy "testimonials: super admin full access" on public.testimonials for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "testimonials: public read published" on public.testimonials for select
  using (published = true);

create policy "associates: super admin full access" on public.associates for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "associates: public read" on public.associates for select
  using (true);

create policy "enquiries: super admin full access" on public.enquiries for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "enquiries: anyone can submit" on public.enquiries for insert
  with check (true);
