import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  /** Deny the request when the limiter itself fails (use for password checks). */
  failClosed?: boolean;
};

type RateLimitResult = { allowed: boolean; retryAfterSec?: number };

function windowId(windowMs: number) {
  return Math.floor(Date.now() / windowMs);
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
  failClosed = false,
}: RateLimitOptions): Promise<RateLimitResult> {
  const bucketKey = `${key}:${windowId(windowMs)}`;
  const windowEndsMs = (windowId(windowMs) + 1) * windowMs;
  const windowEndsAt = new Date(windowEndsMs).toISOString();
  const denied = (): RateLimitResult => ({
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((windowEndsMs - Date.now()) / 1000)),
  });

  try {
    const supabase = createAdminClient();

    // Atomic counter (supabase/schema_launch_1_before_deploy.sql).
    const { data: hits, error: rpcError } = await supabase.rpc("rate_limit_hit", {
      p_bucket_key: bucketKey,
      p_window_ends_at: windowEndsAt,
    });
    if (!rpcError && typeof hits === "number") {
      return hits > limit ? denied() : { allowed: true };
    }

    // Fallback for databases where the function has not been created yet.
    const { data: existing, error: readError } = await supabase
      .from("rate_limit_buckets")
      .select("hit_count")
      .eq("bucket_key", bucketKey)
      .maybeSingle();
    if (readError) throw readError;

    if (!existing) {
      await supabase.from("rate_limit_buckets").insert({
        bucket_key: bucketKey,
        hit_count: 1,
        window_ends_at: windowEndsAt,
      });
      return { allowed: true };
    }
    if (existing.hit_count >= limit) return denied();

    await supabase
      .from("rate_limit_buckets")
      .update({ hit_count: existing.hit_count + 1 })
      .eq("bucket_key", bucketKey);
    return { allowed: true };
  } catch {
    return failClosed ? denied() : { allowed: true };
  }
}

/**
 * Client IP as reported by the hosting platform. Vercel sets `x-real-ip` and
 * overwrites `x-forwarded-for` itself, so neither can be spoofed by the caller
 * there. The last forwarded hop is used as a fallback because it is the one
 * appended by the nearest trusted proxy.
 */
export function clientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  const hops = forwarded?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] || "unknown";
}

/** Parse a JSON body without throwing; returns null when it is not an object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function stringField(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}
