-- Almayo Studio MVP schema
-- Run this in the Supabase SQL Editor (personal project).

-- Extensions
create extension if not exists "pgcrypto";

-- Catalogs (project categories)
create table if not exists public.catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid references public.catalogs (id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  tech_stack text,
  tags text,
  thumbnail_url text,
  thumbnail_position text default '50% 50%',
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Project media gallery
create table if not exists public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  media_type text not null default 'image',
  mime_type text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Site settings (single row expected)
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Almayo Studio',
  tagline text not null default 'Graphic Designer & Software Engineer',
  hero_title text not null default 'Almayo Studio',
  hero_subtitle text not null default 'Graphic Designer & Software Engineer',
  hero_tagline text not null default 'Creating beautiful designs and powerful software solutions.',
  years_experience text not null default '6+',
  countries_served text not null default '3',
  countries_list text default 'Kuwait, EU, Ethiopia',
  whatsapp_number text not null default '+96560644416',
  tab_title text default 'Almayo Studio',
  favicon_url text,
  og_image_url text,
  updated_at timestamptz not null default now()
);

-- About content (single row expected)
create table if not exists public.about_content (
  id uuid primary key default gen_random_uuid(),
  bio text not null default '',
  profile_photo_url text,
  skills jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Contact details (single row expected)
create table if not exists public.contact_details (
  id uuid primary key default gen_random_uuid(),
  email text not null default 'almayo.online@gmail.com',
  phone text not null default '+96560644416',
  location text not null default 'Kuwait',
  whatsapp_number text not null default '+96560644416',
  updated_at timestamptz not null default now()
);

-- Social links
create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Seed defaults
insert into public.site_settings (site_name, hero_title, hero_tagline, whatsapp_number)
select 'Almayo Studio', 'Almayo Studio', 'Creating beautiful designs and powerful software solutions.', '+96560644416'
where not exists (select 1 from public.site_settings);

insert into public.about_content (bio, skills)
select
  'Alemayehu Ibrahim (Almayo), Graphic Designer & Software Engineer based in Kuwait, working with clients across Kuwait, EU, and Ethiopia.',
  '["Brand Identity","UI/UX","Web Development","Next.js","Motion Design"]'::jsonb
where not exists (select 1 from public.about_content);

insert into public.contact_details (email, phone, location, whatsapp_number)
select 'almayo.online@gmail.com', '+96560644416', 'Kuwait', '+96560644416'
where not exists (select 1 from public.contact_details);

insert into public.catalogs (name, slug, description, sort_order)
select * from (values
  ('Branding', 'branding', 'Logo systems and brand identities', 0),
  ('Web & Product', 'web-product', 'Websites, apps, and digital products', 1),
  ('Social & Campaigns', 'social-campaigns', 'Social content and campaign visuals', 2)
) as v(name, slug, description, sort_order)
where not exists (select 1 from public.catalogs);

-- Indexes
create index if not exists projects_visible_sort_idx on public.projects (is_visible, sort_order, created_at desc);
create index if not exists projects_featured_idx on public.projects (is_featured) where is_featured = true;
create index if not exists project_media_project_idx on public.project_media (project_id, sort_order);
create index if not exists catalogs_visible_sort_idx on public.catalogs (is_visible, sort_order);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalogs_set_updated_at on public.catalogs;
create trigger catalogs_set_updated_at before update on public.catalogs
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists about_content_set_updated_at on public.about_content;
create trigger about_content_set_updated_at before update on public.about_content
for each row execute function public.set_updated_at();

drop trigger if exists contact_details_set_updated_at on public.contact_details;
create trigger contact_details_set_updated_at before update on public.contact_details
for each row execute function public.set_updated_at();

-- RLS
alter table public.catalogs enable row level security;
alter table public.projects enable row level security;
alter table public.project_media enable row level security;
alter table public.site_settings enable row level security;
alter table public.about_content enable row level security;
alter table public.contact_details enable row level security;
alter table public.social_links enable row level security;

-- Public read policies
create policy "Public read visible catalogs"
  on public.catalogs for select
  using (is_visible = true or auth.role() = 'authenticated');

create policy "Public read visible projects"
  on public.projects for select
  using (is_visible = true or auth.role() = 'authenticated');

create policy "Public read media of visible projects"
  on public.project_media for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.is_visible = true or auth.role() = 'authenticated')
    )
  );

create policy "Public read site settings"
  on public.site_settings for select
  using (true);

create policy "Public read about content"
  on public.about_content for select
  using (true);

create policy "Public read contact details"
  on public.contact_details for select
  using (true);

create policy "Public read visible social links"
  on public.social_links for select
  using (is_visible = true or auth.role() = 'authenticated');

-- Authenticated admin write policies (single admin via Supabase Auth)
create policy "Auth insert catalogs"
  on public.catalogs for insert to authenticated with check (true);
create policy "Auth update catalogs"
  on public.catalogs for update to authenticated using (true) with check (true);
create policy "Auth delete catalogs"
  on public.catalogs for delete to authenticated using (true);

create policy "Auth insert projects"
  on public.projects for insert to authenticated with check (true);
create policy "Auth update projects"
  on public.projects for update to authenticated using (true) with check (true);
create policy "Auth delete projects"
  on public.projects for delete to authenticated using (true);

create policy "Auth insert project_media"
  on public.project_media for insert to authenticated with check (true);
create policy "Auth update project_media"
  on public.project_media for update to authenticated using (true) with check (true);
create policy "Auth delete project_media"
  on public.project_media for delete to authenticated using (true);

create policy "Auth update site settings"
  on public.site_settings for update to authenticated using (true) with check (true);
create policy "Auth insert site settings"
  on public.site_settings for insert to authenticated with check (true);

create policy "Auth update about content"
  on public.about_content for update to authenticated using (true) with check (true);
create policy "Auth insert about content"
  on public.about_content for insert to authenticated with check (true);

create policy "Auth update contact details"
  on public.contact_details for update to authenticated using (true) with check (true);
create policy "Auth insert contact details"
  on public.contact_details for insert to authenticated with check (true);

create policy "Auth insert social links"
  on public.social_links for insert to authenticated with check (true);
create policy "Auth update social links"
  on public.social_links for update to authenticated using (true) with check (true);
create policy "Auth delete social links"
  on public.social_links for delete to authenticated using (true);

-- Storage bucket for media
insert into storage.buckets (id, name, public)
values ('project-media', 'project-media', true)
on conflict (id) do nothing;

create policy "Public read project media files"
  on storage.objects for select
  using (bucket_id = 'project-media');

create policy "Auth upload project media files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-media');

create policy "Auth update project media files"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-media')
  with check (bucket_id = 'project-media');

create policy "Auth delete project media files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-media');
