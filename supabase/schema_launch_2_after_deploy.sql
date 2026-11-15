-- Launch migration, part 2 of 2.
-- Run in the Supabase SQL Editor AFTER the launch code is deployed
-- (the older code used "select *" as an anonymous visitor, which the column
-- grants below no longer allow). Safe to run more than once.

do $$
begin
  if not exists (select 1 from public.admin_allowlist) then
    raise exception 'admin_allowlist is empty. Run schema_launch_1_before_deploy.sql first.';
  end if;
end $$;

-- 1. Visitors may only read the public columns of clients and projects ---------
--    (client email, phone and address, and internal project flags, stay private)

revoke select on public.clients from anon;
grant select (
  id, name, slug, logo_url, website_url, description, work_types,
  is_visible, sort_order, created_at, updated_at
) on public.clients to anon;

revoke select on public.projects from anon;
grant select (
  id, catalog_id, client_id, title, slug, description, tech_stack, tags,
  thumbnail_url, thumbnail_position, is_featured, is_visible, sort_order,
  created_at, updated_at
) on public.projects to anon;

-- 2. Dashboard data: require an allowlisted admin, not just any signed-in user -

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

-- 3. Storage: same rule for uploads, reads and deletes -------------------------

drop policy if exists "Auth read project media files" on storage.objects;
create policy "Auth read project media files"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "Auth upload project media files" on storage.objects;
create policy "Auth upload project media files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "Auth update project media files" on storage.objects;
create policy "Auth update project media files"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-media' and public.is_admin())
  with check (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "Auth delete project media files" on storage.objects;
create policy "Auth delete project media files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-media' and public.is_admin());

drop policy if exists "Auth read studio files" on storage.objects;
create policy "Auth read studio files"
  on storage.objects for select to authenticated
  using (bucket_id = 'studio-files' and public.is_admin());

drop policy if exists "Auth upload studio files" on storage.objects;
create policy "Auth upload studio files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'studio-files' and public.is_admin());

drop policy if exists "Auth update studio files" on storage.objects;
create policy "Auth update studio files"
  on storage.objects for update to authenticated
  using (bucket_id = 'studio-files' and public.is_admin())
  with check (bucket_id = 'studio-files' and public.is_admin());

drop policy if exists "Auth delete studio files" on storage.objects;
create policy "Auth delete studio files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'studio-files' and public.is_admin());

-- Upload limits enforced by storage itself (25 MB, no scripts or SVG).
update storage.buckets
set file_size_limit = 26214400
where id in ('project-media', 'studio-files');

-- 4. Every project belongs to a client -----------------------------------------

do $$
begin
  if exists (select 1 from public.projects where client_id is null) then
    raise notice 'Skipped: some projects have no client yet. Assign a client (or delete the test project) and run this file again.';
  else
    alter table public.projects alter column client_id set not null;
  end if;
end $$;

-- Check: policies that still allow any signed-in user (expect zero rows).
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and roles = '{authenticated}'
  and tablename <> 'admin_allowlist'
  and (coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true');
