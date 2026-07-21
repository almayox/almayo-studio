-- Homepage testimonials (run in Supabase SQL editor)
-- Safe to re-run

alter table public.site_settings
  add column if not exists testimonials jsonb not null default '[]'::jsonb;
