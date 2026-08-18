-- tiling_jobs only had a SELECT policy for content staff (plus the
-- super-admin ALL policy). But startTilingJob() -- called from both
-- confirmSlideUpload() and retryTiling() -- runs under the acting user's
-- own RLS session (createClient(), not the service-role client), and
-- inserts/updates tiling_jobs directly. With no INSERT/UPDATE policy for
-- non-super-admins, RLS silently rejected every insert for a content
-- manager: `.insert(...).select().single()` returned no row,
-- startTilingJob()'s `if (!job) return;` swallowed it with no error
-- surfaced, and the slide was left on single-image fallback forever.
-- Tiling only ever actually started when a super admin did the upload.
create policy "tiling_jobs: content staff can insert"
  on public.tiling_jobs for insert
  with check (
    exists (
      select 1 from public.slides
      where slides.id = tiling_jobs.slide_id
        and can_manage_content('slides', slides.id, slides.created_by)
    )
  );

create policy "tiling_jobs: content staff can update"
  on public.tiling_jobs for update
  using (
    exists (
      select 1 from public.slides
      where slides.id = tiling_jobs.slide_id
        and can_manage_content('slides', slides.id, slides.created_by)
    )
  )
  with check (
    exists (
      select 1 from public.slides
      where slides.id = tiling_jobs.slide_id
        and can_manage_content('slides', slides.id, slides.created_by)
    )
  );
