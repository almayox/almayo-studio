import { cookies } from "next/headers";
import {
  createReviewAccessValue,
  reviewAccessCookieOptions,
  reviewCookieName,
  verifyReviewAccessValue,
} from "@/lib/reviewAuth";
import { getReviewCampaignByToken } from "@/lib/reviewServer";

export async function assertReviewAccess(token: string, passwordRequired: boolean) {
  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) {
    return { ok: false as const, status: 404, message: "Review not found." };
  }

  if (passwordRequired) {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(reviewCookieName(token))?.value;
    if (!verifyReviewAccessValue(cookie, token)) {
      return { ok: false as const, status: 401, message: "Review password required." };
    }
  }

  return { ok: true as const, campaign };
}

export function setReviewAccessCookie(token: string) {
  const { value, maxAge } = createReviewAccessValue(token);
  return {
    name: reviewCookieName(token),
    value,
    options: reviewAccessCookieOptions(maxAge),
  };
}
