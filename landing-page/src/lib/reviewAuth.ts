import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "review_access";
const MAX_AGE_SEC = 60 * 60 * 24;

function secret() {
  const dedicated = process.env.REVIEW_ACCESS_SECRET;
  if (dedicated) return dedicated;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    // Derive a separate key so the service key itself is never used for cookies.
    return createHmac("sha256", serviceKey).update("review-access-cookie-v1").digest("hex");
  }
  throw new Error("Missing REVIEW_ACCESS_SECRET");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function reviewCookieName(token: string) {
  return `${COOKIE_NAME}_${sign(token).slice(0, 16)}`;
}

/**
 * `binding` ties the cookie to the current review password hash, so changing
 * the password in the dashboard invalidates cookies issued for the old one.
 */
export function createReviewAccessValue(token: string, binding = "") {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const sig = sign(`${token}:${exp}:${binding}`);
  return { value: `${exp}.${sig}`, maxAge: MAX_AGE_SEC };
}

export function verifyReviewAccessValue(
  cookieValue: string | undefined,
  token: string,
  binding = "",
) {
  if (!cookieValue) return false;
  const [expStr, sig] = cookieValue.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`${token}:${exp}:${binding}`);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function reviewAccessCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
