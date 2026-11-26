-- Campaigns review system (MVP parity)
-- Run after schema_contracts.sql

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  month text,
  cover_image_url text,
  objectives text,
  platforms text,
  notes text,
  status text not null default 'draft',
  review_token text not null unique,
  review_password_hash text,
  review_disabled boolean not null default false,
  client_decision text,
  client_approved_by_name text,
  client_approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type text not null default 'single',
  title text not null,
  caption text,
  hashtags text,
  publish_date text,
  notes text,
  media_url text,
  thumbnail_url text,
  sort_order integer not null default 0,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_comments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.campaign_assets (id) on delete cascade,
  author_name text not null,
  body text,
  created_at timestamptz not null default now()
);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists campaign_assets_set_updated_at on public.campaign_assets;
create trigger campaign_assets_set_updated_at before update on public.campaign_assets
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.campaign_assets enable row level security;
alter table public.campaign_comments enable row level security;

drop policy if exists "Public read campaigns for review" on public.campaigns;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Public update campaign decision" on public.campaigns;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Public read campaign assets" on public.campaign_assets;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Public update asset approval" on public.campaign_assets;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Public read comments" on public.campaign_comments;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Public insert comments" on public.campaign_comments;
-- (removed: visitors no longer read or write this table directly; the site uses server routes)

drop policy if exists "Auth all campaigns" on public.campaigns;
create policy "Auth all campaigns"
  on public.campaigns for all to authenticated using (true) with check (true);

drop policy if exists "Auth all campaign_assets" on public.campaign_assets;
create policy "Auth all campaign_assets"
  on public.campaign_assets for all to authenticated using (true) with check (true);

drop policy if exists "Auth all campaign_comments" on public.campaign_comments;
create policy "Auth all campaign_comments"
  on public.campaign_comments for all to authenticated using (true) with check (true);
