/**
 * Campaign types, constants and multi-step deletes, kept apart from the screen.
 */
import type { createClient } from "@/lib/supabase/client";
import { publicSiteUrl } from "@/lib/siteUrl";
import type {
  Campaign,
  CampaignAsset,
  CampaignAssetSlide,
  CampaignComment,
  Client,
} from "@/lib/types";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type AssetRow = CampaignAsset & {
  campaign_asset_slides?: CampaignAssetSlide[];
  campaign_comments?: CampaignComment[];
};

export type CampaignRow = Campaign & {
  clients?: Pick<Client, "name"> | null;
  projects?: { id: string; title: string } | null;
  campaign_assets?: AssetRow[];
};

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes requested" },
];

export const ASSET_APPROVAL_STATUSES = ["pending", "approved", "changes_requested"];

export type AssetType = "single" | "carousel" | "video" | "reel" | "story";

export const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "single", label: "Single post" },
  { value: "carousel", label: "Carousel" },
  { value: "reel", label: "Reel" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story" },
];

/** A new unguessable token for a client review link. */
export function newReviewToken() {
  return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

export function reviewUrl(reviewToken: string) {
  return `${publicSiteUrl()}/review/${reviewToken}`;
}

/**
 * Deletes an asset with its slides and comments.
 * Returns an error message, or null when everything was removed.
 */
export async function deleteAsset(
  supabase: SupabaseBrowserClient,
  assetId: string,
): Promise<string | null> {
  for (const table of ["campaign_asset_slides", "campaign_comments"]) {
    const { error } = await supabase.from(table).delete().eq("asset_id", assetId);
    if (error) return error.message;
  }
  const { error } = await supabase.from("campaign_assets").delete().eq("id", assetId);
  return error ? error.message : null;
}

/**
 * Deletes a campaign with its assets, slides and comments.
 * Returns an error message, or null when everything was removed.
 */
export async function deleteCampaign(
  supabase: SupabaseBrowserClient,
  campaignId: string,
): Promise<string | null> {
  const { data: assets, error: assetsError } = await supabase
    .from("campaign_assets")
    .select("id")
    .eq("campaign_id", campaignId);
  if (assetsError) return assetsError.message;

  const assetIds = (assets || []).map((asset) => asset.id);
  if (assetIds.length) {
    for (const table of ["campaign_asset_slides", "campaign_comments"]) {
      const { error } = await supabase.from(table).delete().in("asset_id", assetIds);
      if (error) return error.message;
    }
  }
  const { error: assetDeleteError } = await supabase
    .from("campaign_assets")
    .delete()
    .eq("campaign_id", campaignId);
  if (assetDeleteError) return assetDeleteError.message;

  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  return error ? error.message : null;
}
