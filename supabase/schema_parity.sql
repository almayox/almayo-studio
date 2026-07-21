-- Full-parity additive migration for Almayo Studio
-- Run in Supabase SQL Editor after schema.sql

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  website_url text,
  email text,
  phone text,
  address text,
  description text,
  work_types text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists client_id uuid references public.clients (id) on delete set null;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  service_interested text,
  message text,
  stage text not null default 'new',
  source text not null default 'contact_form',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(14, 4) not null,
  currency text not null default 'KWD',
  category text,
  merchant_name text,
  payment_method text,
  date text not null,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_name text not null,
  client_email text,
  client_address text,
  client_id uuid references public.clients (id) on delete set null,
  currency text not null default 'KWD',
  status text not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  discount_percent numeric(5, 2) default 0,
  tax_percent numeric(5, 2) default 0,
  tax_label text default 'Tax',
  total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  due_date text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  sort_order integer not null default 0
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null,
  payment_date text not null,
  method text,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_file (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  original_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.logo_variants (
  id uuid primary key default gen_random_uuid(),
  variant_type text not null unique,
  url text,
  updated_at timestamptz not null default now()
);

insert into public.logo_variants (variant_type, url)
select v.variant_type, null
from (values
  ('horizontal'),
  ('icon'),
  ('wordmark'),
  ('navbar_on_dark'),
  ('navbar_on_light')
) as v(variant_type)
where not exists (
  select 1 from public.logo_variants lv where lv.variant_type = v.variant_type
);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists resume_file_set_updated_at on public.resume_file;
create trigger resume_file_set_updated_at before update on public.resume_file
for each row execute function public.set_updated_at();

drop trigger if exists logo_variants_set_updated_at on public.logo_variants;
create trigger logo_variants_set_updated_at before update on public.logo_variants
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.resume_file enable row level security;
alter table public.logo_variants enable row level security;

drop policy if exists "Public read visible clients" on public.clients;
create policy "Public read visible clients"
  on public.clients for select
  using (is_visible = true or auth.role() = 'authenticated');

drop policy if exists "Public read logo variants" on public.logo_variants;
create policy "Public read logo variants"
  on public.logo_variants for select using (true);

drop policy if exists "Public read resume" on public.resume_file;
create policy "Public read resume"
  on public.resume_file for select using (true);

drop policy if exists "Public insert leads" on public.leads;
create policy "Public insert leads"
  on public.leads for insert with check (true);

drop policy if exists "Auth all clients" on public.clients;
create policy "Auth all clients"
  on public.clients for all to authenticated using (true) with check (true);

drop policy if exists "Auth all leads" on public.leads;
create policy "Auth all leads"
  on public.leads for all to authenticated using (true) with check (true);

drop policy if exists "Auth all expenses" on public.expenses;
create policy "Auth all expenses"
  on public.expenses for all to authenticated using (true) with check (true);

drop policy if exists "Auth all invoices" on public.invoices;
create policy "Auth all invoices"
  on public.invoices for all to authenticated using (true) with check (true);

drop policy if exists "Auth all invoice_items" on public.invoice_items;
create policy "Auth all invoice_items"
  on public.invoice_items for all to authenticated using (true) with check (true);

drop policy if exists "Auth all invoice_payments" on public.invoice_payments;
create policy "Auth all invoice_payments"
  on public.invoice_payments for all to authenticated using (true) with check (true);

drop policy if exists "Auth all resume_file" on public.resume_file;
create policy "Auth all resume_file"
  on public.resume_file for all to authenticated using (true) with check (true);

drop policy if exists "Auth all logo_variants" on public.logo_variants;
create policy "Auth all logo_variants"
  on public.logo_variants for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('studio-files', 'studio-files', true)
on conflict (id) do nothing;

drop policy if exists "Public read studio files" on storage.objects;
create policy "Public read studio files"
  on storage.objects for select using (bucket_id = 'studio-files');

drop policy if exists "Auth upload studio files" on storage.objects;
create policy "Auth upload studio files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'studio-files');

drop policy if exists "Auth update studio files" on storage.objects;
create policy "Auth update studio files"
  on storage.objects for update to authenticated
  using (bucket_id = 'studio-files') with check (bucket_id = 'studio-files');

drop policy if exists "Auth delete studio files" on storage.objects;
create policy "Auth delete studio files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'studio-files');
