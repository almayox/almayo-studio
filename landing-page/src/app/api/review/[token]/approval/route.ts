import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp, readJsonObject, stringField } from "@/lib/rateLimit";
import { assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken } from "@/lib/reviewServer";

const ALLOWED = new Set(["approved", "revision_requested", "rejected"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-approval:${ip}:${token}`,
    limit: 60,
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

  const body = await readJsonObject(request);
  const assetId = stringField(body?.assetId, 64);
  const approval_status = stringField(body?.approval_status, 40);
  if (!assetId || !approval_status || !ALLOWED.has(approval_status)) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
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

  const { error } = await supabase
    .from("campaign_assets")
    .update({ approval_status })
    .eq("id", assetId)
    .eq("campaign_id", campaign.id);

  if (error) {
    return NextResponse.json({ message: "Could not update asset." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
