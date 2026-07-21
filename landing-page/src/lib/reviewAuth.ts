import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "review_access";
const MAX_AGE_SEC = 60 * 60 * 24;

function secret() {
  return (
    process.env.REVIEW_ACCESS_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-review-secret-change-me"
  );
}

export function reviewCookieName(token: string) {
  return `${COOKIE_NAME}_${createHmac("sha256", secret()).update(token).digest("hex").slice(0, 16)}`;
}

export function createReviewAccessValue(token: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${token}:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return { value: `${exp}.${sig}`, maxAge: MAX_AGE_SEC };
}

export function verifyReviewAccessValue(cookieValue: string | undefined, token: string) {
  if (!cookieValue) return false;
  const [expStr, sig] = cookieValue.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${token}:${exp}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
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
