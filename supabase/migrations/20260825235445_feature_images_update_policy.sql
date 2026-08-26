-- Replacing a feature's image (new admin "Edit details" flow) re-uses the
-- same storage path (`${featureId}/${fileName}`) and asks for an upsert.
-- Supabase's upsert-on-signed-upload-url is an INSERT ... ON CONFLICT DO
-- UPDATE, which needs an UPDATE policy on storage.objects too — without
-- one, overwriting an existing object fails RLS ("new row violates
-- row-level security policy") even though the INSERT policy below already
-- allows content staff to write into this bucket.
create policy "feature-images bucket: content staff update"
  on storage.objects for update
  using (
    bucket_id = 'feature-images'
    and (
      public.is_super_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager')
    )
  )
  with check (
    bucket_id = 'feature-images'
    and (
      public.is_super_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'content_manager')
    )
  );
