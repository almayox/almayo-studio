import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { setReviewAccessCookie, assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken, verifyReviewPassword } from "@/lib/reviewServer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-unlock:${ip}:${token}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
    );
  }

  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) {
    return NextResponse.json({ message: "Review not found." }, { status: 404 });
  }

  if (!campaign.review_password_hash) {
    const cookie = setReviewAccessCookie(token);
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() ?? "";
  if (!password) {
    return NextResponse.json({ message: "Password is required." }, { status: 400 });
  }

  const valid = await verifyReviewPassword(token, password);
  if (!valid) {
    return NextResponse.json({ message: "Incorrect password." }, { status: 401 });
  }

  const cookie = setReviewAccessCookie(token);
  const response = NextResponse.json({ success: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
