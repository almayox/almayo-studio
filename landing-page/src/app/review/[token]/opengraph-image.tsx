import sharp from "sharp";
import StudioImage from "@/app/opengraph-image";
import { getReviewCampaignByToken } from "@/lib/reviewServer";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { signStorageUrl } from "@/lib/storage";

export const alt = "Campaign in review";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

type Slide = { media_url: string; preview_url?: string | null; sort_order: number };
type Asset = {
  type: string;
  media_url: string | null;
  preview_url?: string | null;
  sort_order: number;
  campaign_asset_slides?: Slide[];
};

function isVideo(url: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

/** The first still image in the campaign, in the order the client sees the posts. */
function firstImage(assets: Asset[]) {
  const sorted = assets.slice().sort((a, b) => a.sort_order - b.sort_order);
  for (const asset of sorted) {
    const slides = (asset.campaign_asset_slides || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const files = slides.length
      ? slides
      : asset.media_url && asset.type !== "video" && asset.type !== "reel"
        ? [asset]
        : [];
    for (const file of files) {
      if (!file.media_url || isVideo(file.media_url)) continue;
      // The smaller review copy is enough for a link preview.
      return file.preview_url || file.media_url;
    }
  }
  return null;
}

async function campaignPicture(token: string) {
  if (!hasSupabaseEnv()) return null;
  const campaign = await getReviewCampaignByToken(token);
  // A password-protected campaign shows no content until it is unlocked.
  if (!campaign || campaign.review_password_hash) return null;
  const stored = firstImage((campaign.campaign_assets || []) as Asset[]);
  const url = await signStorageUrl(stored, 60);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

/**
 * The picture chat apps show next to a shared review link. Always a small JPEG
 * at the standard preview size, which every app accepts (uploads are WebP).
 */
export default async function ReviewLinkImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const picture = await campaignPicture(token).catch(() => null);
  const source = picture ?? Buffer.from(await StudioImage().arrayBuffer());
  const jpeg = await sharp(source)
    .rotate()
    .resize(size.width, size.height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 80 })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
  });
}
