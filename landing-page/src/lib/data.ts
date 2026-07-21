import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { signStorageUrl } from "@/lib/storage";
import type {
  AboutContent,
  Catalog,
  Client,
  ContactDetails,
  Project,
  ProjectMedia,
  ProjectWithCatalog,
  ResumeFile,
  SiteSettings,
  SocialLink,
} from "@/lib/types";
import {
  FALLBACK_ABOUT,
  FALLBACK_CONTACT,
  FALLBACK_SETTINGS,
} from "@/lib/content";

export type LogoVariant = {
  id: string;
  variant_type: string;
  url: string | null;
};

async function signProject<T extends { thumbnail_url?: string | null }>(project: T) {
  return {
    ...project,
    thumbnail_url: project.thumbnail_url
      ? await signStorageUrl(project.thumbnail_url)
      : project.thumbnail_url,
  };
}

async function signClient<T extends { logo_url?: string | null }>(client: T) {
  return {
    ...client,
    logo_url: client.logo_url ? await signStorageUrl(client.logo_url) : client.logo_url,
  };
}

async function signSettings(settings: SiteSettings) {
  return {
    ...settings,
    favicon_url: settings.favicon_url
      ? await signStorageUrl(settings.favicon_url)
      : settings.favicon_url,
    og_image_url: settings.og_image_url
      ? await signStorageUrl(settings.og_image_url)
      : settings.og_image_url,
  };
}

async function signAbout(about: AboutContent) {
  return {
    ...about,
    profile_photo_url: about.profile_photo_url
      ? await signStorageUrl(about.profile_photo_url)
      : about.profile_photo_url,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!hasSupabaseEnv()) return FALLBACK_SETTINGS;
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
  const settings = (data as SiteSettings) ?? FALLBACK_SETTINGS;
  return signSettings(settings);
}

export async function getAboutContent(): Promise<AboutContent> {
  if (!hasSupabaseEnv()) return FALLBACK_ABOUT;
  const supabase = await createClient();
  const { data } = await supabase.from("about_content").select("*").limit(1).maybeSingle();
  const about = (data as AboutContent) ?? FALLBACK_ABOUT;
  return signAbout(about);
}

export async function getContactDetails(): Promise<ContactDetails> {
  if (!hasSupabaseEnv()) return FALLBACK_CONTACT;
  const supabase = await createClient();
  const { data } = await supabase.from("contact_details").select("*").limit(1).maybeSingle();
  return (data as ContactDetails) ?? FALLBACK_CONTACT;
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_links")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  return (data as SocialLink[]) ?? [];
}

export async function getLogoVariants(): Promise<LogoVariant[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("logo_variants").select("*");
  const logos = (data as LogoVariant[]) ?? [];
  return Promise.all(
    logos.map(async (logo) => ({
      ...logo,
      url: logo.url ? await signStorageUrl(logo.url) : logo.url,
    })),
  );
}

export function resolveNavbarLogos(logos: LogoVariant[]) {
  const byType = (type: string) => logos.find((l) => l.variant_type === type)?.url || null;
  const horizontal = byType("horizontal");
  return {
    onDark: byType("navbar_on_dark") || horizontal,
    onLight: byType("navbar_on_light") || horizontal,
  };
}

export async function getCatalogs(): Promise<Catalog[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogs")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });
  const catalogs = (data as Catalog[]) ?? [];
  return Promise.all(
    catalogs.map(async (catalog) => ({
      ...catalog,
      icon:
        catalog.icon && catalog.icon.startsWith("http")
          ? (await signStorageUrl(catalog.icon)) || catalog.icon
          : catalog.icon,
    })),
  );
}

export async function getClients(): Promise<Client[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const clients = (data as Client[]) ?? [];
  return Promise.all(clients.map(signClient));
}

export async function getClientBySlug(slug: string): Promise<{
  client: Client | null;
  projects: ProjectWithCatalog[];
}> {
  if (!hasSupabaseEnv()) return { client: null, projects: [] };
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();
  if (!client) return { client: null, projects: [] };

  const { data: projects } = await supabase
    .from("projects")
    .select("*, catalogs(id, name, slug)")
    .eq("client_id", (client as Client).id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  return {
    client: await signClient(client as Client),
    projects: await Promise.all(((projects as ProjectWithCatalog[]) ?? []).map(signProject)),
  };
}

export async function getResume(): Promise<ResumeFile | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("resume_file")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const resume = data as ResumeFile;
  return {
    ...resume,
    file_url: (await signStorageUrl(resume.file_url)) || resume.file_url,
  };
}

export async function getProjects(options?: {
  featuredOnly?: boolean;
}): Promise<ProjectWithCatalog[]> {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*, catalogs(id, name, slug)")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (options?.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data } = await query;
  return Promise.all(((data as ProjectWithCatalog[]) ?? []).map(signProject));
}

export async function getCatalogBySlug(slug: string): Promise<{
  catalog: Catalog | null;
  projects: ProjectWithCatalog[];
}> {
  if (!hasSupabaseEnv()) return { catalog: null, projects: [] };
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("catalogs")
    .select("*")
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();
  if (!catalog) return { catalog: null, projects: [] };

  const { data: projects } = await supabase
    .from("projects")
    .select("*, catalogs(id, name, slug)")
    .eq("catalog_id", (catalog as Catalog).id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const signedCatalog = {
    ...(catalog as Catalog),
    icon:
      catalog.icon && catalog.icon.startsWith("http")
        ? (await signStorageUrl(catalog.icon)) || catalog.icon
        : catalog.icon,
  };

  return {
    catalog: signedCatalog,
    projects: await Promise.all(((projects as ProjectWithCatalog[]) ?? []).map(signProject)),
  };
}

export async function getProjectBySlug(slug: string): Promise<{
  project: ProjectWithCatalog | null;
  media: ProjectMedia[];
}> {
  if (!hasSupabaseEnv()) return { project: null, media: [] };
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, catalogs(id, name, slug)")
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();

  if (!project) return { project: null, media: [] };

  const { data: media } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", (project as Project).id)
    .order("sort_order", { ascending: true });

  const signedMedia = await Promise.all(
    ((media as ProjectMedia[]) ?? []).map(async (item) => ({
      ...item,
      url: (await signStorageUrl(item.url)) || item.url,
    })),
  );

  return {
    project: await signProject(project as ProjectWithCatalog),
    media: signedMedia,
  };
}
