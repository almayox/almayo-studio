const DEFAULT_SITE_URL = "https://almayostudio.com";

/** Public landing-site origin (no trailing slash), used for client-facing links. */
export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}
