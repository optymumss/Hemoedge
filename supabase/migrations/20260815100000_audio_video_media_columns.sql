-- Optional audio narration + video demonstration media, attachable to any of
-- the four content types the product spec called out. Kept as plain nullable
-- columns (mirrors the existing `image_path` pattern on features) rather than
-- a separate media table, since each row has at most one audio and one video.
alter table public.modules
  add column audio_path text,
  add column audio_transcript text,
  add column video_path text;

alter table public.lessons
  add column audio_path text,
  add column audio_transcript text,
  add column video_path text;

alter table public.cases
  add column audio_path text,
  add column audio_transcript text,
  add column video_path text;

alter table public.features
  add column audio_path text,
  add column audio_transcript text,
  add column video_path text;
