-- The Feature Library was missing three of its five written sections, and
-- had no way to attach a cropped morphology image at all.
alter table public.features add column why_it_matters text;
alter table public.features add column differential_diagnoses text;
alter table public.features add column common_confusions text;
alter table public.features add column image_path text;

insert into storage.buckets (id, name, public)
values ('feature-images', 'feature-images', false);

-- Mirrors the existing "slides bucket" storage policies: content staff can
-- upload, any authenticated user can read (features are reference material
-- used across roles), and the uploader or a super admin can delete.
create policy "feature-images bucket: content staff upload"
  on storage.objects for insert
  with check (
    bucket_id = 'feature-images'
    and (
      public.is_super_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager')
    )
  );

create policy "feature-images bucket: authenticated read"
  on storage.objects for select
  using (bucket_id = 'feature-images' and auth.uid() is not null);

create policy "feature-images bucket: owner or super admin delete"
  on storage.objects for delete
  using (bucket_id = 'feature-images' and (owner = auth.uid() or public.is_super_admin()));
