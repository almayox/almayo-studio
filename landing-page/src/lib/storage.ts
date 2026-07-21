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

export async function signStorageUrls(
  urls: Array<string | null | undefined>,
  expiresIn = 3600,
) {
  return Promise.all(urls.map((url) => signStorageUrl(url, expiresIn)));
}

export function isSupabaseStorageUrl(url: string | null | undefined) {
  return Boolean(parseSupabaseStorageUrl(url));
}

export function toStoredStorageUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return `${bucket}/${path}`;
  return `${base}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}
