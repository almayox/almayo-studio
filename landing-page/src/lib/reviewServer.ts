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

export async function getReviewCampaignByToken(token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, campaign_assets(*, campaign_asset_slides(*))")
    .eq("review_token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (!isReviewAccessible(data as ReviewCampaign)) return null;
  return data;
}

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
