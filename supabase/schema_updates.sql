-- Countries list shown on About page (comma separated)
alter table public.site_settings
  add column if not exists countries_list text default 'Kuwait, EU, Ethiopia';

update public.site_settings
set countries_list = 'Kuwait, EU, Ethiopia'
where countries_list is null;

-- Catalog icons (Lucide name or uploaded image URL)
alter table public.catalogs
  add column if not exists icon text;

-- Campaign review link expiry
alter table public.campaigns
  add column if not exists review_token_expires_at timestamptz;

-- Run in Supabase SQL Editor after existing schema files

-- Invoice fixed discount (in addition to discount_percent)
alter table public.invoices
  add column if not exists discount_amount numeric(12, 2) default 0;

-- Payment audit trail (records added + deleted payments)
create table if not exists public.invoice_payment_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  action text not null check (action in ('added', 'deleted')),
  amount numeric(12, 2) not null,
  currency text not null default 'KWD',
  payment_date date,
  method text,
  notes text,
  payment_id uuid,
  created_at timestamptz not null default now()
);

alter table public.invoice_payment_events enable row level security;

drop policy if exists "Auth all invoice_payment_events" on public.invoice_payment_events;
create policy "Auth all invoice_payment_events"
  on public.invoice_payment_events for all to authenticated using (true) with check (true);

-- Contract developer audit (client fields already exist)
alter table public.contracts
  add column if not exists developer_signer_ip text,
  add column if not exists developer_signer_device_info text;

-- Campaign carousel slides (if not run yet)
create table if not exists public.campaign_asset_slides (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.campaign_assets (id) on delete cascade,
  media_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.campaign_asset_slides enable row level security;

drop policy if exists "Public read slides" on public.campaign_asset_slides;
create policy "Public read slides"
  on public.campaign_asset_slides for select
  using (
    exists (
      select 1
      from public.campaign_assets a
      join public.campaigns c on c.id = a.campaign_id
      where a.id = asset_id
        and (
          (c.status in ('review', 'approved', 'changes_requested') and c.review_disabled = false)
          or auth.role() = 'authenticated'
        )
    )
  );

drop policy if exists "Auth all slides" on public.campaign_asset_slides;
create policy "Auth all slides"
  on public.campaign_asset_slides for all to authenticated
  using (true) with check (true);

-- Security hardening: run supabase/schema_security.sql next
