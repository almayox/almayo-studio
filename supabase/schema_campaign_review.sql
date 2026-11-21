-- Campaign review: protected previews, voice notes, activity record, file release.
-- Run once in the Supabase SQL Editor, after schema_launch_1_before_deploy.sql
-- (it needs public.is_admin()). Safe to run again.

-- Campaign: linked invoice, release of final files, when it was sent.
alter table public.campaigns
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null,
  add column if not exists files_released_at timestamptz,
  add column if not exists review_sent_at timestamptz;

-- Smaller copies shown to the client until files are released.
alter table public.campaign_assets
  add column if not exists preview_url text,
  -- Platforms this post goes to, when not all of the campaign's.
  add column if not exists platforms text;

alter table public.campaign_asset_slides
  add column if not exists preview_url text;

-- Voice notes and replies from the studio.
alter table public.campaign_comments
  add column if not exists audio_url text,
  add column if not exists from_studio boolean not null default false;

-- Record of everything that happened on a review: who, what, when, from where.
-- Rows can be added and read, never edited or deleted (except with the campaign).
create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  asset_id uuid references public.campaign_assets (id) on delete set null,
  kind text not null,
  actor_name text,
  detail text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_events_campaign_idx
  on public.campaign_events (campaign_id, created_at desc);

alter table public.campaign_events enable row level security;

drop policy if exists "Admin read campaign_events" on public.campaign_events;
create policy "Admin read campaign_events"
  on public.campaign_events for select to authenticated
  using (public.is_admin());

drop policy if exists "Admin add campaign_events" on public.campaign_events;
create policy "Admin add campaign_events"
  on public.campaign_events for insert to authenticated
  with check (public.is_admin());
