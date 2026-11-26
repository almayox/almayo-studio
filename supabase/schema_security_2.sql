-- Security hardening, part 2.
-- Run in the Supabase SQL Editor after every other file. Safe to run again.
-- If an older schema file is ever run again, run this file once more after it:
-- it closes anything the older file re-opened.

do $$
begin
  if not exists (select 1 from public.admin_allowlist) then
    raise exception 'admin_allowlist is empty. Run schema_launch_1_before_deploy.sql first.';
  end if;
end $$;

-- 1. Admin check: the signed-in email must be on the allowlist ----------------
--    (sign-in is email and password; there is no second step)

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

-- 2. Visitors never read or write these tables directly -----------------------
--    (review, contract signing and the contact form go through server routes)

drop policy if exists "Public read campaigns for review" on public.campaigns;
drop policy if exists "Public update campaign decision" on public.campaigns;
drop policy if exists "Public read campaign assets" on public.campaign_assets;
drop policy if exists "Public update asset approval" on public.campaign_assets;
drop policy if exists "Public read comments" on public.campaign_comments;
drop policy if exists "Public insert comments" on public.campaign_comments;
drop policy if exists "Public read slides" on public.campaign_asset_slides;
drop policy if exists "Public read contracts by status" on public.contracts;
drop policy if exists "Public sign contracts" on public.contracts;
drop policy if exists "Public read milestones" on public.contract_milestones;
drop policy if exists "Public insert leads" on public.leads;
drop policy if exists "Public read studio files" on storage.objects;

update storage.buckets set public = false where id = 'studio-files';

-- 3. Public pages show visible rows only; hidden rows need an admin -----------
--    (before, any signed-in account could read hidden rows and client details)

drop policy if exists "Public read visible catalogs" on public.catalogs;
create policy "Public read visible catalogs"
  on public.catalogs for select using (is_visible = true);

drop policy if exists "Public read visible projects" on public.projects;
create policy "Public read visible projects"
  on public.projects for select using (is_visible = true);

drop policy if exists "Public read media of visible projects" on public.project_media;
create policy "Public read media of visible projects"
  on public.project_media for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.is_visible = true
    )
  );

drop policy if exists "Public read visible social links" on public.social_links;
create policy "Public read visible social links"
  on public.social_links for select using (is_visible = true);

drop policy if exists "Public read visible clients" on public.clients;
create policy "Public read visible clients"
  on public.clients for select using (is_visible = true);

drop policy if exists "Admin read catalogs" on public.catalogs;
create policy "Admin read catalogs"
  on public.catalogs for select to authenticated using (public.is_admin());

drop policy if exists "Admin read projects" on public.projects;
create policy "Admin read projects"
  on public.projects for select to authenticated using (public.is_admin());

drop policy if exists "Admin read project_media" on public.project_media;
create policy "Admin read project_media"
  on public.project_media for select to authenticated using (public.is_admin());

drop policy if exists "Admin read social links" on public.social_links;
create policy "Admin read social links"
  on public.social_links for select to authenticated using (public.is_admin());

drop policy if exists "Admin read clients" on public.clients;
create policy "Admin read clients"
  on public.clients for select to authenticated using (public.is_admin());

-- 4. Any policy still open to every signed-in account becomes admin-only ------

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and roles = '{authenticated}'
      and tablename <> 'admin_allowlist'
      and coalesce(qual, 'true') = 'true'
      and coalesce(with_check, 'true') = 'true'
  loop
    if p.cmd = 'INSERT' then
      execute format('alter policy %I on %I.%I with check (public.is_admin())',
        p.policyname, p.schemaname, p.tablename);
    elsif p.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on %I.%I using (public.is_admin())',
        p.policyname, p.schemaname, p.tablename);
    else
      execute format(
        'alter policy %I on %I.%I using (public.is_admin()) with check (public.is_admin())',
        p.policyname, p.schemaname, p.tablename);
    end if;
  end loop;
end $$;

-- Check: every policy a visitor without an account can use. Expect read-only
-- (SELECT) rows for the public site tables and nothing else.
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where schemaname in ('public', 'storage')
  and (roles = '{public}' or roles @> '{anon}')
order by schemaname, tablename, policyname;
