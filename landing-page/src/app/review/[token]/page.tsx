import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { verifyReviewAccessValue, reviewCookieName } from "@/lib/reviewAuth";
import { getReviewCampaignByToken } from "@/lib/reviewServer";
import { signStorageUrl } from "@/lib/storage";
import { CampaignReviewClient } from "./CampaignReviewClient";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Campaign review",
  robots: { index: false, follow: false },
};

type StoredAsset = {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string | null;
  publish_date: string | null;
  media_url: string | null;
  approval_status: string;
  type: string;
  sort_order: number;
  campaign_asset_slides?: Array<{
    id: string;
    media_url: string;
    caption: string | null;
    sort_order: number;
  }>;
};

/** Older reviews saved these values; the dashboard only knows "changes_requested". */
const LEGACY_APPROVAL: Record<string, string> = {
  revision_requested: "changes_requested",
  rejected: "changes_requested",
};

/**
 * Builds what the client's browser receives: only the fields the review page
 * shows, with signed file links. Internal notes never leave the server.
 */
async function toClientAssets(assets: StoredAsset[]) {
  return Promise.all(
    assets.map(async (asset) => ({
      id: asset.id,
      title: asset.title,
      caption: asset.caption,
      hashtags: asset.hashtags,
      publish_date: asset.publish_date,
      type: asset.type,
      approval_status: LEGACY_APPROVAL[asset.approval_status] ?? asset.approval_status,
      media_url: asset.media_url ? await signStorageUrl(asset.media_url) : null,
      campaign_asset_slides: await Promise.all(
        (asset.campaign_asset_slides || []).map(async (slide) => ({
          id: slide.id,
          caption: slide.caption,
          sort_order: slide.sort_order,
          media_url: (await signStorageUrl(slide.media_url)) || slide.media_url,
        })),
      ),
    })),
  );
}

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  if (!hasSupabaseEnv()) notFound();

  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) notFound();

  const passwordRequired = Boolean(campaign.review_password_hash);
  let initialUnlocked = !passwordRequired;
  if (passwordRequired) {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(reviewCookieName(token))?.value;
    initialUnlocked = verifyReviewAccessValue(
      cookie,
      token,
      campaign.review_password_hash ?? "",
    );
  }

  // Locked: send only the title and the password form. No assets, comments,
  // objectives or signed file links leave the server until the cookie is valid.
  if (!initialUnlocked) {
    return (
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-32 sm:px-6">
        <CampaignReviewClient
          token={token}
          title={campaign.title}
          objectives={null}
          platforms={null}
          assets={[]}
          comments={[]}
          alreadyDecided={false}
          decision={null}
          passwordRequired
          initialUnlocked={false}
        />
      </div>
    );
  }

  const assets = ((campaign.campaign_assets || []) as StoredAsset[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const signedAssets = await toClientAssets(assets);
  const assetIds = assets.map((a) => a.id);

  const supabase = await (await import("@/lib/supabase/admin")).createAdminClient();
  const { data: comments } = assetIds.length
    ? await supabase
        .from("campaign_comments")
        .select("id, asset_id, author_name, body, created_at")
        .in("asset_id", assetIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-32 sm:px-6">
      <CampaignReviewClient
        token={token}
        title={campaign.title}
        objectives={campaign.objectives}
        platforms={campaign.platforms}
        assets={signedAssets}
        comments={comments || []}
        alreadyDecided={campaign.status !== "review"}
        decision={campaign.client_decision}
        passwordRequired={passwordRequired}
        initialUnlocked={initialUnlocked}
      />
    </div>
  );
}
