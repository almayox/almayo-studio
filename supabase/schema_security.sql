-- Security hardening migration
-- Run in Supabase SQL Editor after schema_updates.sql

-- Rate limiting (service role only; no public policies)
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  hit_count integer not null default 1,
  window_ends_at timestamptz not null
);

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_ends_at);

alter table public.rate_limit_buckets enable row level security;

-- Admin allowlist for future team expansion (owner manages via SQL for now)
create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

drop policy if exists "Auth read own allowlist row" on public.admin_allowlist;
create policy "Auth read own allowlist row"
  on public.admin_allowlist for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Auth all admin_allowlist" on public.admin_allowlist;
create policy "Auth all admin_allowlist"
  on public.admin_allowlist for all to authenticated
  using (
    exists (
      select 1 from public.admin_allowlist a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.admin_allowlist a
      where lower(a.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Campaigns: remove anonymous access (public flows use service role API routes)
drop policy if exists "Public read campaigns for review" on public.campaigns;
drop policy if exists "Public update campaign decision" on public.campaigns;

drop policy if exists "Public read campaign assets" on public.campaign_assets;
drop policy if exists "Public update asset approval" on public.campaign_assets;

drop policy if exists "Public read comments" on public.campaign_comments;
drop policy if exists "Public insert comments" on public.campaign_comments;

drop policy if exists "Public read slides" on public.campaign_asset_slides;

-- Contracts: remove anonymous access
drop policy if exists "Public read contracts by status" on public.contracts;
drop policy if exists "Public sign contracts" on public.contracts;
drop policy if exists "Public read milestones" on public.contract_milestones;

-- Storage: studio-files is private (signed URLs). project-media is public:
-- it holds the portfolio shown on the site.
update storage.buckets set public = false where id = 'studio-files';

drop policy if exists "Public read project media files" on storage.objects;
drop policy if exists "Public read studio files" on storage.objects;

drop policy if exists "Auth read project media files" on storage.objects;
create policy "Auth read project media files"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-media');

drop policy if exists "Auth read studio files" on storage.objects;
create policy "Auth read studio files"
  on storage.objects for select to authenticated
  using (bucket_id = 'studio-files');

-- Leads: contact form inserts via service role API (no public insert needed)
drop policy if exists "Public insert leads" on public.leads;

-- Add your admin email after running this file:
-- insert into public.admin_allowlist (email) values ('you@example.com');
-- Or set ADMIN_ALLOWED_EMAILS in dashboard env (comma separated).
