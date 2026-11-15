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

async function signAssetMedia<T extends {
  id: string;
  title: string;
  caption: string | null;
  media_url: string | null;
  thumbnail_url?: string | null;
  approval_status: string;
  type: string;
  campaign_asset_slides?: Array<{ id: string; media_url: string; caption: string | null; sort_order: number }>;
}>(assets: T[]) {
  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      media_url: asset.media_url ? await signStorageUrl(asset.media_url) : null,
      thumbnail_url: asset.thumbnail_url
        ? await signStorageUrl(asset.thumbnail_url)
        : asset.thumbnail_url,
      campaign_asset_slides: asset.campaign_asset_slides
        ? await Promise.all(
            asset.campaign_asset_slides.map(async (slide) => ({
              ...slide,
              media_url: (await signStorageUrl(slide.media_url)) || slide.media_url,
            })),
          )
        : undefined,
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

  const assets = (campaign.campaign_assets || []).sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
  );
  const signedAssets = await signAssetMedia(assets);
  const assetIds = assets.map((a: { id: string }) => a.id);

  const supabase = await (await import("@/lib/supabase/admin")).createAdminClient();
  const { data: comments } = assetIds.length
    ? await supabase
        .from("campaign_comments")
        .select("*")
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
