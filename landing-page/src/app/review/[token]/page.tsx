import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { verifyReviewAccessValue, reviewCookieName } from "@/lib/reviewAuth";
import {
  areFilesReleased,
  getReviewCampaignByToken,
  logReviewViewed,
} from "@/lib/reviewServer";
import { parseSupabaseStorageUrl, signStorageUrl } from "@/lib/storage";
import { CampaignReviewClient } from "./CampaignReviewClient";
import { ReviewUnlockForm } from "./ReviewUnlockForm";
import type { ReviewComment, ReviewPost } from "./types";

type Props = { params: Promise<{ token: string }> };

/**
 * What chat apps show when the link is shared: "Brand | Campaign", with a
 * picture from the campaign supplied by opengraph-image.tsx beside this file.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const robots = { index: false, follow: false };
  const { token } = await params;
  const campaign = hasSupabaseEnv() ? await getReviewCampaignByToken(token) : null;
  if (!campaign) return { title: "Content review", robots };

  const title = [campaign.clients?.name, campaign.title].filter(Boolean).join(" | ");
  const description = ["Content ready for your review", monthLabel(campaign.month)]
    .filter(Boolean)
    .join(" · ");
  return {
    title: { absolute: title },
    description,
    robots,
    openGraph: { title, description, url: "./", siteName: "Almayo Studio", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

type StoredSlide = {
  id: string;
  media_url: string;
  preview_url?: string | null;
  sort_order: number;
};

type StoredAsset = {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string | null;
  publish_date: string | null;
  platforms?: string | null;
  media_url: string | null;
  preview_url?: string | null;
  approval_status: string;
  type: string;
  sort_order: number;
  campaign_asset_slides?: StoredSlide[];
};

/** Older reviews saved these values; the dashboard only knows "changes_requested". */
const LEGACY_APPROVAL: Record<string, string> = {
  revision_requested: "changes_requested",
  rejected: "changes_requested",
};

function isVideoUrl(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

function monthLabel(month: string | null) {
  const match = month ? /^(\d{4})-(\d{2})$/.exec(month) : null;
  if (!match) return month || "";
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/** A one-hour link that downloads the original file. */
async function signDownloadUrl(url: string) {
  const parsed = parseSupabaseStorageUrl(url);
  if (!parsed) return null;
  const { data } = await createAdminClient()
    .storage.from(parsed.bucket)
    .createSignedUrl(parsed.path, 3600, { download: true });
  return data?.signedUrl ?? null;
}

/**
 * Builds what the client's browser receives: only the fields the review page
 * shows. Until the files are released it gets the smaller review copy, never a
 * link to the original image.
 */
/** Review copies made before watermarks were dropped live in ".../previews/". */
function cleanPreview(url: string | null | undefined) {
  return url && !url.includes("/previews/") ? url : null;
}

async function toReviewPosts(assets: StoredAsset[], released: boolean): Promise<ReviewPost[]> {
  return Promise.all(
    assets.map(async (asset) => {
      const slides = (asset.campaign_asset_slides || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order);
      const files = slides.length
        ? slides.map((slide) => ({
            id: slide.id,
            original: slide.media_url,
            preview: cleanPreview(slide.preview_url),
            video: isVideoUrl(slide.media_url),
          }))
        : asset.media_url
          ? [
              {
                id: asset.id,
                original: asset.media_url,
                preview: cleanPreview(asset.preview_url),
                video:
                  asset.type === "video" || asset.type === "reel" || isVideoUrl(asset.media_url),
              },
            ]
          : [];

      return {
        id: asset.id,
        title: asset.title,
        caption: asset.caption,
        hashtags: asset.hashtags,
        publish_date: asset.publish_date,
        platforms: asset.platforms ?? null,
        type: asset.type,
        approval_status: LEGACY_APPROVAL[asset.approval_status] ?? asset.approval_status,
        media: await Promise.all(
          files.map(async (file) => ({
            id: file.id,
            video: file.video,
            url:
              (await signStorageUrl(released ? file.original : file.preview || file.original)) ||
              "",
            downloadUrl: released ? await signDownloadUrl(file.original) : null,
          })),
        ),
      };
    }),
  );
}

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  if (!hasSupabaseEnv()) notFound();

  const campaign = await getReviewCampaignByToken(token);
  if (!campaign) notFound();

  if (campaign.review_password_hash) {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(reviewCookieName(token))?.value;
    // Locked: only the title and the password form leave the server.
    if (!verifyReviewAccessValue(cookie, token, campaign.review_password_hash)) {
      return (
        <div className="mx-auto max-w-5xl px-5 pb-24 pt-32 sm:px-6">
          <ReviewUnlockForm token={token} title={campaign.title} />
        </div>
      );
    }
  }

  const released = await areFilesReleased(campaign);
  const assets = ((campaign.campaign_assets || []) as StoredAsset[])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const posts = await toReviewPosts(assets, released);
  const assetIds = assets.map((asset) => asset.id);

  const supabase = createAdminClient();
  const { data: storedComments } = assetIds.length
    ? await supabase
        .from("campaign_comments")
        .select("*")
        .in("asset_id", assetIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const comments: ReviewComment[] = await Promise.all(
    (storedComments || []).map(async (comment) => ({
      id: comment.id,
      asset_id: comment.asset_id,
      author_name: comment.author_name,
      body: comment.body,
      audio_url: comment.audio_url ? await signStorageUrl(comment.audio_url) : null,
      from_studio: Boolean(comment.from_studio),
      created_at: comment.created_at,
    })),
  );

  if (campaign.status === "review") {
    const headerList = await headers();
    await logReviewViewed(campaign.id, headerList.get("x-real-ip"));
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-40 pt-32 sm:px-6">
      <CampaignReviewClient
        token={token}
        campaign={{
          title: campaign.title,
          clientName: campaign.clients?.name ?? null,
          clientLogo: campaign.clients?.logo_url
            ? await signStorageUrl(campaign.clients.logo_url)
            : null,
          month: monthLabel(campaign.month),
          platforms: campaign.platforms,
          note: campaign.objectives,
          status: campaign.status,
          decidedBy: campaign.client_approved_by_name,
          decidedAt: campaign.client_approved_at,
          released,
        }}
        posts={posts}
        comments={comments}
      />
    </div>
  );
}
