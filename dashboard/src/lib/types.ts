export type Catalog = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type CatalogWithStats = Catalog & {
  project_count: number;
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
  /** Internal: whether this project needs a signed contract. */
  contract_required?: boolean;
  /** How the public project page is laid out. */
  display_style?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
  /** A PDF's pages as images, in order. Its `url` is the first page. */
  pages?: { url: string; width: number; height: number }[] | null;
  /** A PDF written right to left (Arabic). */
  rtl?: boolean | null;
  /** Media sharing a key are one social media post (a carousel). */
  group_key?: string | null;
  /** Which part stays visible when the picture is cropped, e.g. "30% 50%". */
  poster_position?: string | null;
  /** The post's kind in the social grid, on its first item; empty means automatic. */
  post_type?: "post" | "carousel" | "reel" | null;
  sort_order: number;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  work_types: string | null;
  is_visible: boolean;
  sort_order: number;
};

export type Lead = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  service_interested: string | null;
  message: string | null;
  stage: string;
  source: string;
  notes: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  category: string | null;
  merchant_name: string | null;
  payment_method: string | null;
  date: string;
  notes: string | null;
  receipt_url: string | null;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  client_id: string | null;
  currency: string;
  status: string;
  subtotal: string | number;
  discount_percent: string | number | null;
  discount_amount?: string | number | null;
  tax_percent: string | number | null;
  tax_label: string | null;
  total: string | number;
  amount_paid: string | number;
  due_date: string | null;
  notes: string | null;
  /** Quotation this invoice was converted from, if any. */
  quotation_id?: string | null;
  /** Project this invoice bills, if any. */
  project_id?: string | null;
  created_at: string;
};

export type Quotation = {
  id: string;
  quote_number: string;
  client_id: string;
  project_id: string | null;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  title: string | null;
  currency: string;
  /** draft | sent | accepted | declined | expired */
  status: string;
  subtotal: string | number;
  discount_percent: string | number | null;
  discount_amount: string | number | null;
  tax_percent: string | number | null;
  tax_label: string | null;
  total: string | number;
  valid_until: string | null;
  notes: string | null;
  /** Set once, when the quotation is converted into an invoice. */
  converted_invoice_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  sort_order: number;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  sort_order: number;
};

export type InvoicePaymentEvent = {
  id: string;
  invoice_id: string;
  action: "added" | "deleted";
  amount: string | number;
  currency: string;
  payment_date: string | null;
  method: string | null;
  notes: string | null;
  payment_id: string | null;
  created_at: string;
};

export type ClientProjectSummary = {
  id: string;
  title: string;
  is_visible: boolean;
  catalog_name: string | null;
};

export type ClientStats = Client & {
  projects?: ClientProjectSummary[];
  project_count: number;
  contract_count: number;
  invoice_count: number;
  campaign_count: number;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  amount: string | number;
  currency: string;
  payment_date: string;
  method: string | null;
  notes: string | null;
  receipt_url: string | null;
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
  countries_list?: string | null;
  whatsapp_number: string;
  tab_title: string | null;
  favicon_url?: string | null;
  og_image_url?: string | null;
  testimonials?: unknown;
};

export type AboutContent = {
  id: string;
  bio: string;
  profile_photo_url: string | null;
  skills: string[] | string;
  experience?: unknown;
  certifications?: unknown;
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

export type ResumeFile = {
  id: string;
  file_url: string;
  original_name: string | null;
};

export type LogoVariant = {
  id: string;
  variant_type: string;
  url: string | null;
};

export type Contract = {
  id: string;
  title: string;
  project_id: string | null;
  client_id: string | null;
  terms: string | null;
  terms_ar: string | null;
  status: string;
  token: string;
  developer_signed_at: string | null;
  developer_signed_name: string | null;
  developer_signer_device_info?: string | null;
  signed_by_name: string | null;
  signed_at: string | null;
  signer_ip?: string | null;
  signer_device_info?: string | null;
  created_at: string;
};

export type ContractMilestone = {
  id: string;
  contract_id: string;
  name: string;
  amount: string | number;
  discount_amount: string | number | null;
  currency: string;
  duration: string | null;
  due_date: string | null;
  sort_order: number;
};

export type Campaign = {
  id: string;
  title: string;
  client_id: string | null;
  project_id: string | null;
  month: string | null;
  cover_image_url: string | null;
  objectives: string | null;
  platforms: string | null;
  notes: string | null;
  status: string;
  review_token: string;
  review_password_hash: string | null;
  review_disabled: boolean;
  client_decision: string | null;
  client_approved_by_name: string | null;
  client_approved_at: string | null;
  published_at?: string | null;
  review_token_expires_at?: string | null;
  /** Invoice that pays for this campaign; final files unlock when it is paid. */
  invoice_id?: string | null;
  files_released_at?: string | null;
  review_sent_at?: string | null;
};

export type CampaignAsset = {
  id: string;
  campaign_id: string;
  type: string;
  title: string;
  caption: string | null;
  hashtags: string | null;
  publish_date: string | null;
  notes: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  /** Smaller copy the client sees until files are released. */
  preview_url?: string | null;
  /** Platforms this post goes to, comma separated; empty means not stated. */
  platforms?: string | null;
  sort_order: number;
  approval_status: string;
};

export type CampaignAssetSlide = {
  id: string;
  asset_id: string;
  media_url: string;
  preview_url?: string | null;
  caption: string | null;
  sort_order: number;
};

export type CampaignComment = {
  id: string;
  asset_id: string;
  author_name: string;
  body: string | null;
  /** Voice note recorded by the client. */
  audio_url?: string | null;
  /** True for a reply written in the dashboard. */
  from_studio?: boolean;
  created_at: string;
};

export type CampaignEvent = {
  id: string;
  campaign_id: string;
  asset_id: string | null;
  kind: string;
  actor_name: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
