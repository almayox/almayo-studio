import { createClient } from "@/lib/supabase/client";

const PUBLIC_PATH_RE =
  /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export function parseSupabaseStorageUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url) return null;
  const match = url.match(PUBLIC_PATH_RE);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

export async function resolveStorageUrl(
  url: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseSupabaseStorageUrl(url);
  if (!parsed) return url;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}

export function toStoredStorageUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return `${bucket}/${path}`;
  return `${base}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}
