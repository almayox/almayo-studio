import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

function windowId(windowMs: number) {
  return Math.floor(Date.now() / windowMs);
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const bucketKey = `${key}:${windowId(windowMs)}`;
  const windowEndsAt = new Date((windowId(windowMs) + 1) * windowMs).toISOString();

  try {
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("rate_limit_buckets")
      .select("hit_count")
      .eq("bucket_key", bucketKey)
      .maybeSingle();

    if (!existing) {
      await supabase.from("rate_limit_buckets").insert({
        bucket_key: bucketKey,
        hit_count: 1,
        window_ends_at: windowEndsAt,
      });
      return { allowed: true };
    }

    if (existing.hit_count >= limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((new Date(windowEndsAt).getTime() - Date.now()) / 1000),
      );
      return { allowed: false, retryAfterSec };
    }

    await supabase
      .from("rate_limit_buckets")
      .update({ hit_count: existing.hit_count + 1 })
      .eq("bucket_key", bucketKey);

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
