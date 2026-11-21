export type Catalog = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type Project = {
  id: string;
  catalog_id: string | null;
  client_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  tech_stack: string | null;
  tags: string | null;
  thumbnail_url: string | null;
  thumbnail_position: string | null;
  is_featured: boolean;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  work_types: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type ResumeFile = {
  id: string;
  file_url: string;
  original_name: string | null;
};

export type ProjectMedia = {
  id: string;
  project_id: string;
  url: string;
  media_type: string;
  mime_type: string | null;
  caption: string | null;
  /** A video's own thumbnail image, shown before it plays. */
  poster_url?: string | null;
  /** A PDF's pages as images, in order. */
  pages?: { url: string; width: number; height: number }[] | null;
  /** A PDF written right to left (Arabic). */
  rtl?: boolean | null;
  /** Media sharing a key are one social media post (a carousel). */
  group_key?: string | null;
  /** Which part stays visible when the picture is cropped, e.g. "30% 50%". */
  poster_position?: string | null;
  sort_order: number;
};

export type SiteSettings = {
  id: string;
  site_name: string;
  tagline: string;
  hero_title: string;
  hero_subtitle: string;
  hero_tagline: string;
  years_experience: string;
  countries_served: string;
  countries_list: string | null;
  whatsapp_number: string;
  tab_title: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  testimonials?: unknown;
};

export type AboutContent = {
  id: string;
  bio: string;
  profile_photo_url: string | null;
  skills: string[] | string;
  experience: unknown;
  certifications: unknown;
  services?: unknown;
};

export type ContactDetails = {
  id: string;
  email: string;
  phone: string;
  location: string;
  whatsapp_number: string;
};

export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  is_visible: boolean;
  sort_order: number;
};

export type ProjectWithCatalog = Project & {
  catalogs: Pick<Catalog, "id" | "name" | "slug"> | null;
  /** Present only when the client is public (visible). */
  clients?: Pick<Client, "name" | "slug"> | null;
};
