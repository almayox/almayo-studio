import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/password";

export type ReviewCampaign = {
  id: string;
  title: string;
  objectives: string | null;
  platforms: string | null;
  status: string;
  review_disabled: boolean;
  review_password_hash: string | null;
  review_token_expires_at: string | null;
  client_decision: string | null;
};

export function isReviewExpired(campaign: Pick<ReviewCampaign, "review_token_expires_at">) {
  if (!campaign.review_token_expires_at) return false;
  return new Date(campaign.review_token_expires_at).getTime() < Date.now();
}

export function isReviewAccessible(campaign: ReviewCampaign) {
  if (campaign.review_disabled) return false;
  if (isReviewExpired(campaign)) return false;
  return ["review", "approved", "changes_requested"].includes(campaign.status);
}

/** Cached per request, so the page and its link-preview details share one lookup. */
export const getReviewCampaignByToken = cache(async (token: string) => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, clients(name, logo_url), campaign_assets(*, campaign_asset_slides(*))")
    .eq("review_token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (!isReviewAccessible(data as ReviewCampaign)) return null;
  return data;
});

export async function verifyReviewPassword(token: string, password: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("campaigns")
    .select("review_password_hash")
    .eq("review_token", token)
    .maybeSingle();
  if (!data?.review_password_hash) return true;
  return verifyPassword(password, data.review_password_hash);
}

/** Final files are released by hand, or automatically once the linked invoice is paid. */
export async function areFilesReleased(campaign: {
  files_released_at?: string | null;
  invoice_id?: string | null;
}) {
  if (campaign.files_released_at) return true;
  if (!campaign.invoice_id) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", campaign.invoice_id)
    .maybeSingle();
  return data?.status === "paid";
}

type ReviewEvent = {
  kind: string;
  assetId?: string | null;
  actor?: string | null;
  detail?: string | null;
  ip?: string | null;
};

/**
 * Adds a line to the campaign's activity record: who did what, when and from
 * where. Never blocks the action itself.
 */
export async function logReviewEvent(campaignId: string, event: ReviewEvent) {
  try {
    await createAdminClient()
      .from("campaign_events")
      .insert({
        campaign_id: campaignId,
        asset_id: event.assetId ?? null,
        kind: event.kind,
        actor_name: event.actor ?? null,
        detail: event.detail ? event.detail.slice(0, 500) : null,
        ip: event.ip ?? null,
      });
  } catch {
    // The record is best effort.
  }
}

/** Records that the link was opened, at most once every six hours. */
export async function logReviewViewed(campaignId: string, ip: string | null) {
  try {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("campaign_events")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("kind", "viewed")
      .gte("created_at", since)
      .limit(1);
    if (data && data.length === 0) await logReviewEvent(campaignId, { kind: "viewed", ip });
  } catch {
    // The record is best effort.
  }
}
