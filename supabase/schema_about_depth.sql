-- About page depth: services list for "What I can do"
-- Run in Supabase SQL editor

alter table public.about_content
  add column if not exists services jsonb not null default '[]'::jsonb;
