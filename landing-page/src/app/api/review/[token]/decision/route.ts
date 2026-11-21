import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp, readJsonObject, stringField } from "@/lib/rateLimit";
import { assertReviewAccess } from "@/lib/reviewAccess";
import { getReviewCampaignByToken, logReviewEvent } from "@/lib/reviewServer";

/**
 * The client's final answer. Approving approves every post and locks the
 * review; sending change requests closes this round until the studio sends
 * the campaign again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(request);
  const limit = await checkRateLimit({
    key: `review-decision:${ip}:${token}`,
    limit: 10,
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
    return NextResponse.json({ message: "This review is already locked." }, { status: 409 });
  }

  const body = await readJsonObject(request);
  const client_decision = body?.client_decision;
  const author_name = stringField(body?.author_name, 120);

  if (!author_name) {
    return NextResponse.json({ message: "Enter your name before submitting." }, { status: 400 });
  }
  if (client_decision !== "approved" && client_decision !== "changes_requested") {
    return NextResponse.json({ message: "Invalid decision." }, { status: 400 });
  }

  const assets = (campaign.campaign_assets || []) as { approval_status: string }[];
  const withChanges = assets.filter((asset) => asset.approval_status !== "approved" && asset.approval_status !== "pending").length;
  if (client_decision === "approved" && withChanges > 0) {
    return NextResponse.json(
      { message: "Some posts still have change requests. Approve them or send the requests." },
      { status: 400 },
    );
  }
  if (client_decision === "changes_requested" && withChanges === 0) {
    return NextResponse.json(
      { message: "Mark at least one post as needing changes first." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from("campaigns")
    .update({
      status: client_decision,
      client_decision,
      client_approved_by_name: author_name,
      client_approved_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)
    .eq("review_token", token)
    .eq("status", "review")
    .select("id");

  if (error || !updated?.length) {
    return NextResponse.json({ message: "Could not submit your decision." }, { status: 500 });
  }

  if (client_decision === "approved") {
    await supabase
      .from("campaign_assets")
      .update({ approval_status: "approved" })
      .eq("campaign_id", campaign.id);
  }

  await logReviewEvent(campaign.id, {
    kind: client_decision === "approved" ? "campaign_approved" : "campaign_changes_requested",
    actor: author_name,
    detail:
      client_decision === "approved"
        ? `All ${assets.length} posts approved. Review locked.`
        : `${withChanges} post(s) need changes.`,
    ip,
  });

  return NextResponse.json({ success: true });
}
