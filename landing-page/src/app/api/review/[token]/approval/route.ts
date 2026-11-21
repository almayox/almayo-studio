import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp, readJsonObject, stringField } from "@/lib/rateLimit";
import { assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken, logReviewEvent } from "@/lib/reviewServer";

const ALLOWED = new Set(["approved", "changes_requested"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-approval:${ip}:${token}`,
    limit: 120,
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
    return NextResponse.json({ message: "This review is locked." }, { status: 409 });
  }

  const body = await readJsonObject(request);
  const assetId = stringField(body?.assetId, 64);
  const approval_status = stringField(body?.approval_status, 40);
  const author_name = stringField(body?.author_name, 120);
  if (!assetId || !ALLOWED.has(approval_status)) {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  if (!author_name) {
    return NextResponse.json({ message: "Enter your name first." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: asset } = await supabase
    .from("campaign_assets")
    .select("id, title")
    .eq("id", assetId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("campaign_assets")
    .update({ approval_status })
    .eq("id", assetId)
    .eq("campaign_id", campaign.id);

  if (error) {
    return NextResponse.json({ message: "Could not save your answer." }, { status: 500 });
  }

  await logReviewEvent(campaign.id, {
    kind: approval_status === "approved" ? "post_approved" : "post_changes_requested",
    assetId,
    actor: author_name,
    detail: asset.title,
    ip,
  });

  return NextResponse.json({ success: true });
}
