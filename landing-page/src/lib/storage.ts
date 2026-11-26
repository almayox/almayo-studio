import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_PATH_RE =
  /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;
const SIGNED_PATH_RE =
  /\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(?:\?|$)/i;

export function parseSupabaseStorageUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url) return null;
  const publicMatch = url.match(PUBLIC_PATH_RE);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }
  const signedMatch = url.match(SIGNED_PATH_RE);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }
  return null;
}

export async function signStorageUrl(
  url: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseSupabaseStorageUrl(url);
  if (!parsed) return url;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}

/** Buckets that are public-read: their files are served from stable URLs. */
const PUBLIC_BUCKETS = new Set(["project-media"]);

const LONG_SIGN_SEC = 60 * 60 * 24 * 7;
const REUSE_MS = 60 * 60 * 24 * 1000;
const signedCache = new Map<string, { url: string; reuseUntil: number }>();

/**
 * URL for an asset shown on the public site (portfolio media, logos, photos).
 *
 * Portfolio media lives in a public bucket, so its URL never changes and the
 * browser, the CDN and the image optimiser can all cache it. Assets in the
 * private bucket get a long-lived signed URL that is reused between requests,
 * instead of a new URL on every page view.
 */
export async function publicAssetUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const parsed = parseSupabaseStorageUrl(url);
  if (!parsed) return url;

  if (PUBLIC_BUCKETS.has(parsed.bucket)) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base
      ? `${base}/storage/v1/object/public/${parsed.bucket}/${encodeURI(parsed.path)}`
      : url;
  }

  const key = `${parsed.bucket}/${parsed.path}`;
  const cached = signedCache.get(key);
  if (cached && cached.reuseUntil > Date.now()) return cached.url;

  const signed = await signStorageUrl(url, LONG_SIGN_SEC);
  if (signed && signed !== url) {
    if (signedCache.size > 500) signedCache.clear();
    signedCache.set(key, { url: signed, reuseUntil: Date.now() + REUSE_MS });
  }
  return signed;
}

export function toStoredStorageUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return `${bucket}/${path}`;
  return `${base}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}
