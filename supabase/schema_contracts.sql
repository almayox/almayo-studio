-- Contracts parity migration
-- Run in Supabase SQL Editor after schema_parity.sql

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  terms text,
  terms_ar text,
  status text not null default 'draft',
  token text not null unique,
  developer_signed_at timestamptz,
  developer_signed_name text,
  signed_by_name text,
  signed_at timestamptz,
  signer_ip text,
  signer_device_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null,
  discount_amount numeric(12, 2),
  currency text not null default 'KWD',
  duration text,
  due_date text,
  invoice_id uuid references public.invoices (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();

alter table public.contracts enable row level security;
alter table public.contract_milestones enable row level security;

-- Public can read sent/signed contracts by knowing the token (filter in app)
drop policy if exists "Public read contracts by status" on public.contracts;
create policy "Public read contracts by status"
  on public.contracts for select
  using (status in ('sent', 'signed') or auth.role() = 'authenticated');

drop policy if exists "Public sign contracts" on public.contracts;
create policy "Public sign contracts"
  on public.contracts for update
  using (status = 'sent')
  with check (status in ('sent', 'signed'));

drop policy if exists "Public read milestones" on public.contract_milestones;
create policy "Public read milestones"
  on public.contract_milestones for select
  using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and (c.status in ('sent', 'signed') or auth.role() = 'authenticated')
    )
  );

drop policy if exists "Auth all contracts" on public.contracts;
create policy "Auth all contracts"
  on public.contracts for all to authenticated using (true) with check (true);

drop policy if exists "Auth all contract_milestones" on public.contract_milestones;
create policy "Auth all contract_milestones"
  on public.contract_milestones for all to authenticated using (true) with check (true);
