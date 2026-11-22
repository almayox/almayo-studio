-- Project media: video thumbnails, PDF books, and the look of a project page.
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.project_media
  -- A video's own thumbnail image, shown before the video plays.
  add column if not exists poster_url text,
  -- A PDF's pages as images, in order: [{ "url": "...", "width": 1200, "height": 1600 }, ...]
  add column if not exists pages jsonb,
  -- A PDF written right to left (Arabic): the book opens the other way.
  add column if not exists rtl boolean not null default false,
  -- Media with the same key are one social media post (a carousel).
  add column if not exists group_key text,
  -- Which part of the picture stays visible when it is cropped, e.g. '30% 50%'.
  add column if not exists poster_position text,
  -- The post's kind in the social media grid, set on its first item:
  -- 'post', 'carousel' or 'reel'. Empty means it is worked out from the files.
  add column if not exists post_type text;

-- How the project page is laid out: 'gallery', 'social' or 'video'.
alter table public.projects
  add column if not exists display_style text not null default 'gallery';

-- Visitors may read the layout choice (other project columns are granted in
-- schema_launch_2_after_deploy.sql).
grant select (display_style) on public.projects to anon;
