-- Quotations. Run in the Supabase SQL Editor after
-- schema_launch_1_before_deploy.sql (it needs public.is_admin()).
-- Safe to run more than once.
--
-- Rule: a quotation can be converted into an invoice exactly once.
-- An invoice is never turned back into a quotation.

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  client_name text not null,
  client_email text,
  client_address text,
  title text,
  currency text not null default 'KWD',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  subtotal numeric(12, 2) not null default 0,
  discount_percent numeric(5, 2) default 0,
  discount_amount numeric(12, 2) default 0,
  tax_percent numeric(5, 2) default 0,
  tax_label text default 'Tax',
  total numeric(12, 2) not null default 0,
  valid_until date,
  notes text,
  -- Set once, when the quotation is converted. Unique: one invoice per quote.
  converted_invoice_id uuid unique references public.invoices (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  sort_order integer not null default 0
);

create index if not exists quotations_client_idx on public.quotations (client_id);
create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- Invoices remember where they came from and which project they bill.
alter table public.invoices
  add column if not exists quotation_id uuid references public.quotations (id) on delete set null;
alter table public.invoices
  add column if not exists project_id uuid references public.projects (id) on delete set null;

drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

drop policy if exists "Admin all quotations" on public.quotations;
create policy "Admin all quotations"
  on public.quotations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin all quotation_items" on public.quotation_items;
create policy "Admin all quotation_items"
  on public.quotation_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
