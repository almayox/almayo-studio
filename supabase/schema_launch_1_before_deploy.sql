-- Launch migration, part 1 of 2.
-- Run in the Supabase SQL Editor BEFORE deploying the launch code.
-- Everything here is additive: the currently deployed site keeps working.
-- Safe to run more than once.

-- 1. Admin check used by row level security and by the dashboard ---------------

-- Seed the allowlist with the accounts that already exist (public sign-up is
-- disabled, so these are the owner's own accounts). Review the list printed at
-- the end of this file and delete any row that should not be an admin.
insert into public.admin_allowlist (email)
select lower(u.email)
from auth.users u
where u.email is not null
  and not exists (select 1 from public.admin_allowlist)
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- The old policy queried its own table, which Postgres rejects as recursive.
drop policy if exists "Auth all admin_allowlist" on public.admin_allowlist;
create policy "Auth all admin_allowlist"
  on public.admin_allowlist for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Atomic rate limit counter (called by the site with the service role) ------

create or replace function public.rate_limit_hit(
  p_bucket_key text,
  p_window_ends_at timestamptz
)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limit_buckets (bucket_key, hit_count, window_ends_at)
  values (p_bucket_key, 1, p_window_ends_at)
  on conflict (bucket_key)
  do update set hit_count = public.rate_limit_buckets.hit_count + 1
  returning hit_count;
$$;

revoke all on function public.rate_limit_hit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, timestamptz) to service_role;

delete from public.rate_limit_buckets where window_ends_at < now() - interval '1 day';

-- 3. Projects: contract is optional per project --------------------------------

alter table public.projects
  add column if not exists contract_required boolean not null default false;

-- 4. Portfolio media is public by nature: serve it from stable, cacheable URLs.
--    Receipts, contracts, campaign files and brand files stay in the private
--    "studio-files" bucket.
update storage.buckets set public = true where id = 'project-media';

-- Check: these accounts can use the dashboard.
select email as dashboard_admin, created_at from public.admin_allowlist order by created_at;
