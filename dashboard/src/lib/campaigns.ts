/**
 * Campaign types, rules and multi-step writes, kept apart from the screens.
 */
import type { createClient } from "@/lib/supabase/client";
import { publicSiteUrl } from "@/lib/siteUrl";
import { uploadStudioFile } from "@/lib/upload";
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
  campaign_assets?: AssetRow[];
};

/** Invoice fields the campaign screen needs to show payment state. */
export type CampaignInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  total: string | number;
  amount_paid: string | number;
};

/* ---------- Stages ---------- */

export type CampaignStage = "draft" | "review" | "changes_requested" | "approved" | "published";

export const STAGES: { value: CampaignStage; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
];

export function campaignStage(campaign: Pick<Campaign, "status" | "published_at">): CampaignStage {
  if (campaign.published_at) return "published";
  const known = STAGES.find((stage) => stage.value === campaign.status);
  return known ? known.value : "draft";
}

export function stageLabel(stage: CampaignStage) {
  return STAGES.find((item) => item.value === stage)?.label ?? stage;
}

export const STAGE_TONES: Record<CampaignStage, string> = {
  draft: "border-line bg-subtle text-fg/70",
  review: "border-amber-100 bg-amber-50 text-amber-800",
  changes_requested: "border-red-100 bg-red-50 text-red-800",
  approved: "border-emerald-100 bg-emerald-50 text-emerald-800",
  published: "border-blue-100 bg-blue-50 text-blue-800",
};

export const CLEARED_DECISION = {
  client_decision: null,
  client_approved_by_name: null,
  client_approved_at: null,
};

/** Final files are released by hand, or automatically once the linked invoice is paid. */
export function filesReleased(
  campaign: Pick<Campaign, "files_released_at">,
  invoice: Pick<CampaignInvoice, "status"> | null,
) {
  return Boolean(campaign.files_released_at) || invoice?.status === "paid";
}

/* ---------- Month and platforms ---------- */

export const PLATFORM_OPTIONS = [
  "Instagram",
  "TikTok",
  "Facebook",
  "Snapchat",
  "YouTube",
  "LinkedIn",
  "X",
];

export function parsePlatforms(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "2026-12" becomes "December 2026"; anything else is shown as written. */
export function monthLabel(month: string | null | undefined) {
  if (!month) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/* ---------- Posts ---------- */

/** The three kinds of post. */
export type PostKind = "single" | "carousel" | "reel";

export const POST_KINDS: {
  value: PostKind;
  label: string;
  hint: string;
  /** File types the kind accepts. */
  accept: string;
}[] = [
  { value: "single", label: "Image", hint: "One image per post", accept: "image/*" },
  {
    value: "carousel",
    label: "Carousel",
    hint: "Images and videos in one post",
    accept: "image/*,video/*",
  },
  { value: "reel", label: "Reel", hint: "One video per post", accept: "video/*" },
];

/** The kind of a stored post, including ones saved with the older types. */
export function postKind(asset: Pick<CampaignAsset, "type" | "media_url">): PostKind {
  if (asset.type === "carousel") return "carousel";
  return isVideoType(asset.type) || isVideoUrl(asset.media_url) ? "reel" : "single";
}

/** True when the file may be used for this kind of post. */
export function fileFitsKind(file: File, kind: PostKind) {
  if (kind === "single") return file.type.startsWith("image/");
  if (kind === "reel") return file.type.startsWith("video/");
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

export function isVideoType(type: string) {
  return type === "video" || type === "reel";
}

export function isVideoUrl(url: string | null | undefined) {
  return Boolean(url && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url));
}

/** Values the client review page saved before it used "changes_requested". */
const LEGACY_APPROVAL: Record<string, string> = {
  revision_requested: "changes_requested",
  rejected: "changes_requested",
};

/** Maps old approval values on loaded campaigns to the ones the screens know. */
export function withCurrentApprovalStatuses(campaigns: CampaignRow[]): CampaignRow[] {
  return campaigns.map((campaign) => ({
    ...campaign,
    campaign_assets: campaign.campaign_assets?.map((asset) => ({
      ...asset,
      approval_status: LEGACY_APPROVAL[asset.approval_status] ?? asset.approval_status,
    })),
  }));
}

export function approvalCounts(assets: AssetRow[]) {
  const count = (status: string) => assets.filter((a) => a.approval_status === status).length;
  return {
    total: assets.length,
    approved: count("approved"),
    changes: count("changes_requested"),
    pending: count("pending"),
  };
}

/* ---------- Review link ---------- */

/** A new unguessable token for a client review link. */
export function newReviewToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function reviewUrl(reviewToken: string) {
  return `${publicSiteUrl()}/review/${reviewToken}`;
}

/* ---------- Review copies ---------- */

const REVIEW_MAX_EDGE = 900;

/**
 * A smaller, clean copy of an image. This is what the client sees until the
 * files are released, so the full-quality original cannot be taken from the
 * review page. Returns null for videos and for images the browser cannot read.
 */
async function makeReviewCopy(file: File): Promise<File | null> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, REVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", 0.72),
    );
    if (!blob) return null;
    return new File([blob], "review.webp", { type: blob.type });
  } catch {
    return null;
  }
}

export type UploadedMedia = { url: string; previewUrl: string | null };

/** Reports what is happening during uploads, e.g. "Compressing video 40%…". */
export type UploadStatus = (label: string) => void;

/**
 * Uploads a post file and, for images, its review copy, both at the same time.
 * Videos over the storage limit are compressed in the browser first.
 */
export async function uploadPostMedia(
  campaignId: string,
  file: File,
  onStatus?: UploadStatus,
): Promise<UploadedMedia> {
  // uploadStudioFile compresses videos over the storage limit; this only names
  // what it is doing.
  const video = file.type.startsWith("video/");
  let compressing = false;
  const [url, previewUrl] = await Promise.all([
    uploadStudioFile(file, {
      folder: `campaigns/${campaignId}`,
      onPhase: (phase) => {
        compressing = video && phase === "compressing";
        if (compressing) onStatus?.("Compressing video…");
        else if (video && phase === "uploading") onStatus?.("Uploading video…");
      },
      onProgress: (pct) => {
        if (compressing && pct > 0 && pct < 100) onStatus?.(`Compressing video ${pct}%…`);
      },
    }),
    makeReviewCopy(file).then((copy) =>
      copy
        ? uploadStudioFile(copy, { folder: `campaigns/${campaignId}/review`, optimizeImage: false })
        : null,
    ),
  ]);
  return { url, previewUrl };
}

/** Uploads several post files, three at a time, keeping their order. */
async function uploadPostMediaList(
  campaignId: string,
  files: File[],
  onStatus?: UploadStatus,
): Promise<UploadedMedia[]> {
  const results: UploadedMedia[] = new Array(files.length);
  let next = 0;
  let done = 0;
  const report = () =>
    onStatus?.(files.length > 1 ? `Uploaded ${done} of ${files.length}…` : "Uploading…");
  report();
  async function worker() {
    while (next < files.length) {
      const index = next;
      next += 1;
      results[index] = await uploadPostMedia(campaignId, files[index], onStatus);
      done += 1;
      report();
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return results;
}

/* ---------- Creating and arranging posts ---------- */

/** Turns "column missing" database errors into what to do about them. */
export function readableDbError(message: string) {
  return /schema cache|does not exist/i.test(message)
    ? "The database is missing a recent change. Run supabase/schema_campaign_review.sql in the Supabase SQL Editor, then try again."
    : message;
}

/** Drops empty optional fields, so they are not sent when nothing was chosen. */
function withoutEmpty<T extends Record<string, unknown>>(values: T | undefined) {
  return Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== null && value !== ""),
  );
}

/** Details shared by the posts created in one go. */
export type NewPostDetails = {
  caption?: string | null;
  hashtags?: string | null;
  publish_date?: string | null;
  platforms?: string | null;
};

/**
 * Uploads the files and creates posts from them, starting at `position` in the
 * grid. As a carousel all files go into one post; otherwise every image becomes
 * an image post and every video a reel. Throws with a readable message.
 */
export async function createPosts(
  supabase: SupabaseBrowserClient,
  campaignId: string,
  files: File[],
  options: {
    carousel: boolean;
    position: number;
    details?: NewPostDetails;
    onStatus?: UploadStatus;
  },
) {
  const uploaded = await uploadPostMediaList(campaignId, files, options.onStatus);
  // A carousel is one post showing its first slide.
  const covers = options.carousel ? uploaded.slice(0, 1) : uploaded;
  const { data: created, error } = await supabase
    .from("campaign_assets")
    .insert(
      covers.map((item, index) => ({
        campaign_id: campaignId,
        ...withoutEmpty(options.details),
        type: options.carousel
          ? "carousel"
          : files[index].type.startsWith("video/")
            ? "reel"
            : "single",
        title: `Post ${options.position + index + 1}`,
        media_url: item.url,
        thumbnail_url: item.url,
        preview_url: item.previewUrl,
        sort_order: options.position + index,
        approval_status: "pending",
      })),
    )
    .select("id");
  if (error) throw new Error(readableDbError(error.message));

  if (options.carousel && created?.[0]) {
    const { error: slidesError } = await supabase.from("campaign_asset_slides").insert(
      uploaded.map((item, index) => ({
        asset_id: created[0].id,
        media_url: item.url,
        preview_url: item.previewUrl,
        sort_order: index,
      })),
    );
    if (slidesError) {
      throw new Error(`Post created, but its slides were not saved: ${slidesError.message}`);
    }
  }
}

/**
 * Adds files to a post as carousel slides. An image post becomes a carousel
 * with its current image as the first slide. Returns an error message or null.
 */
export async function addSlidesToPost(
  supabase: SupabaseBrowserClient,
  campaignId: string,
  asset: AssetRow,
  files: File[],
  onStatus?: UploadStatus,
): Promise<string | null> {
  let next = asset.campaign_asset_slides?.length ?? 0;
  if (next === 0 && asset.media_url) {
    const { error } = await supabase.from("campaign_asset_slides").insert({
      asset_id: asset.id,
      media_url: asset.media_url,
      preview_url: asset.preview_url ?? null,
      sort_order: 0,
    });
    if (error) return error.message;
    next = 1;
  }
  const uploaded = await uploadPostMediaList(campaignId, files, onStatus);
  const { error: slideError } = await supabase.from("campaign_asset_slides").insert(
    uploaded.map((item, index) => ({
      asset_id: asset.id,
      media_url: item.url,
      preview_url: item.previewUrl,
      sort_order: next + index,
    })),
  );
  if (slideError) return slideError.message;

  const cover =
    next === 0
      ? {
          media_url: uploaded[0].url,
          thumbnail_url: uploaded[0].url,
          preview_url: uploaded[0].previewUrl,
        }
      : {};
  const { error } = await supabase
    .from("campaign_assets")
    .update({ ...cover, type: "carousel" })
    .eq("id", asset.id);
  return error ? error.message : null;
}

/** `items` with the one at `from` moved to `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Saves a new order by writing `sort_order` for the rows whose place changed.
 * Returns an error message or null.
 */
export async function saveSortOrder(
  supabase: SupabaseBrowserClient,
  table: "campaign_assets" | "campaign_asset_slides",
  ordered: { id: string; sort_order: number }[],
): Promise<string | null> {
  const results = await Promise.all(
    ordered.map((row, index) =>
      row.sort_order === index
        ? null
        : supabase.from(table).update({ sort_order: index }).eq("id", row.id),
    ),
  );
  return results.find((result) => result?.error)?.error?.message ?? null;
}

/* ---------- Activity record ---------- */

/** Adds a line to the campaign's activity record. Never blocks the action itself. */
export async function logCampaignEvent(
  supabase: SupabaseBrowserClient,
  campaignId: string,
  kind: string,
  detail?: string | null,
) {
  await supabase
    .from("campaign_events")
    .insert({ campaign_id: campaignId, kind, detail: detail ?? null, actor_name: "Studio" });
}

/* ---------- Deletes ---------- */

/**
 * Deletes a post with its slides and comments.
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
 * Deletes a campaign with its posts, slides and comments.
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
