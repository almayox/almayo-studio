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
    return NextResponse.json({ message: "Review is already submitted." }, { status: 409 });
  }

  const body = (await request.json()) as {
    client_decision?: "approved" | "changes_requested";
    author_name?: string;
  };
  const client_decision = body.client_decision;
  const author_name = body.author_name?.trim() ?? "";

  if (!author_name) {
    return NextResponse.json({ message: "Enter your name before submitting." }, { status: 400 });
  }
  if (client_decision !== "approved" && client_decision !== "changes_requested") {
    return NextResponse.json({ message: "Invalid decision." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      status: client_decision === "approved" ? "approved" : "changes_requested",
      client_decision,
      client_approved_by_name: author_name,
      client_approved_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)
    .eq("review_token", token)
    .eq("status", "review");

  if (error) {
    return NextResponse.json({ message: "Could not submit decision." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
