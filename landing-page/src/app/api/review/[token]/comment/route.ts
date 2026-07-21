import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken } from "@/lib/reviewServer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-comment:${ip}:${token}`,
    limit: 40,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429 });
  }

  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) {
    return NextResponse.json({ message: "Review not found." }, { status: 404 });
  }

  const access = await assertReviewAccess(token, Boolean(campaign.review_password_hash));
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  if (campaign.status !== "review") {
    return NextResponse.json({ message: "Review is closed." }, { status: 409 });
  }

  const body = (await request.json()) as {
    assetId?: string;
    author_name?: string;
    body?: string;
  };
  const assetId = body.assetId?.trim();
  const author_name = body.author_name?.trim() ?? "";
  const commentBody = body.body?.trim() ?? "";

  if (!assetId || !author_name || commentBody.length < 2) {
    return NextResponse.json({ message: "Name and comment are required." }, { status: 400 });
  }
  if (commentBody.length > 4000) {
    return NextResponse.json({ message: "Comment is too long." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: asset } = await supabase
    .from("campaign_assets")
    .select("id, campaign_id")
    .eq("id", assetId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("campaign_comments")
    .insert({
      asset_id: assetId,
      author_name,
      body: commentBody,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: "Could not post comment." }, { status: 500 });
  }

  return NextResponse.json({ comment: data });
}
