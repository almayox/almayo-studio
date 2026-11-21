/**
 * Turns an approved campaign into a portfolio project, and later brings the
 * project up to date with the campaign. Nothing here runs by itself: the owner
 * presses a button, because a campaign can hold work that must not be public.
 */
import { isVideoUrl, type CampaignRow } from "@/lib/campaigns";
import { parseSupabaseStorageUrl, toStoredStorageUrl } from "@/lib/storage";
import type { createClient } from "@/lib/supabase/client";
import { slugify, type ProjectMedia } from "@/lib/types";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

const PROJECT_BUCKET = "project-media";

/** Where a campaign's files live inside the public portfolio storage. */
function campaignFolder(campaignId: string) {
  return `projects/campaign-${campaignId}`;
}

/** The campaign's files in the order the client saw them: post by post, slide by slide. */
function campaignFiles(campaign: CampaignRow) {
  const posts = (campaign.campaign_assets || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  return posts.flatMap((post) => {
    const slides = (post.campaign_asset_slides || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const urls = slides.length ? slides.map((slide) => slide.media_url) : [post.media_url];
    return urls
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        url,
        video: post.type === "reel" || isVideoUrl(url),
        // Slides of one post stay together as a carousel in the social grid.
        group: urls.length > 1 ? post.id : null,
      }));
  });
}

/**
 * Copies a campaign file from private storage into the portfolio's public
 * storage and returns its new address. The same file always gets the same
 * address, which is how an update knows what is already in the project.
 */
async function copyToPortfolio(supabase: SupabaseBrowserClient, campaignId: string, url: string) {
  const source = parseSupabaseStorageUrl(url);
  // Not one of our stored files: use it as it is.
  if (!source) return url;
  const name = source.path.split("/").pop() || "file";
  const destination = `${campaignFolder(campaignId)}/${name}`;
  const { error } = await supabase.storage
    .from(source.bucket)
    .copy(source.path, destination, { destinationBucket: PROJECT_BUCKET });
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(`A file could not be copied to the portfolio: ${error.message}`);
  }
  return toStoredStorageUrl(PROJECT_BUCKET, destination);
}

async function copyAll(supabase: SupabaseBrowserClient, campaign: CampaignRow) {
  const files = campaignFiles(campaign);
  const copied: PortfolioFile[] = new Array(files.length);
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const index = next;
      next += 1;
      copied[index] = {
        url: await copyToPortfolio(supabase, campaign.id, files[index].url),
        video: files[index].video,
        group: files[index].group,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  return copied;
}

/** Names the missing database update instead of a column error. */
function readable(message: string) {
  return new Error(
    /display_style|group_key/.test(message)
      ? "The database needs an update first: run supabase/schema_project_video_thumbnails.sql in Supabase."
      : message,
  );
}

type PortfolioFile = { url: string; video: boolean; group: string | null };

function mediaRow(projectId: string, file: PortfolioFile, sortOrder: number) {
  return {
    ...(file.group ? { group_key: file.group } : {}),
    project_id: projectId,
    url: file.url,
    media_type: file.video ? "video" : "image",
    mime_type: file.video ? "video/mp4" : null,
    sort_order: sortOrder,
  };
}

async function freeSlug(supabase: SupabaseBrowserClient, title: string) {
  const base = slugify(title) || "project";
  const { data } = await supabase.from("projects").select("slug").like("slug", `${base}%`);
  const taken = new Set((data || []).map((row) => row.slug as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** The project this campaign was published as, if it still exists. */
export async function linkedProject(supabase: SupabaseBrowserClient, campaign: CampaignRow) {
  if (!campaign.project_id) return null;
  const { data } = await supabase
    .from("projects")
    .select("id, title, is_visible")
    .eq("id", campaign.project_id)
    .maybeSingle();
  return (data as { id: string; title: string; is_visible: boolean } | null) ?? null;
}

/**
 * Creates a draft project from the campaign: same client and title, the
 * campaign's files as its media. Returns the new project's id.
 */
export async function createProjectFromCampaign(
  supabase: SupabaseBrowserClient,
  campaign: CampaignRow,
) {
  if (!campaign.client_id) throw new Error("Choose a client for this campaign first.");
  const files = await copyAll(supabase, campaign);
  if (!files.length) throw new Error("This campaign has no posts to publish yet.");

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      title: campaign.title,
      slug: await freeSlug(supabase, campaign.title),
      client_id: campaign.client_id,
      tags: campaign.platforms,
      thumbnail_url: files.find((file) => !file.video)?.url ?? null,
      thumbnail_position: "50% 50%",
      // Campaign posts are shown as a social media grid.
      display_style: "social",
      // A draft: the owner checks it and publishes it from Projects.
      is_visible: false,
      is_featured: false,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error) throw readable(error.message);

  const { error: mediaError } = await supabase
    .from("project_media")
    .insert(files.map((file, index) => mediaRow(project.id, file, index)));
  if (mediaError) throw readable(mediaError.message);

  const { error: linkError } = await supabase
    .from("campaigns")
    .update({ project_id: project.id })
    .eq("id", campaign.id);
  if (linkError) throw new Error(linkError.message);
  return project.id as string;
}

/**
 * Brings the project's media in line with the campaign: new files are added,
 * files removed from the campaign are removed, and the order follows the
 * campaign. Media the owner added to the project by hand, video thumbnails,
 * and the project's title and text are left alone.
 */
export async function updateProjectFromCampaign(
  supabase: SupabaseBrowserClient,
  campaign: CampaignRow,
  projectId: string,
) {
  const files = await copyAll(supabase, campaign);
  const { data } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  const existing = (data as ProjectMedia[]) ?? [];
  const byUrl = new Map(existing.map((item) => [item.url, item]));
  const wanted = new Set(files.map((file) => file.url));
  const fromCampaign = (item: ProjectMedia) =>
    parseSupabaseStorageUrl(item.url)?.path.startsWith(`${campaignFolder(campaign.id)}/`) ?? false;

  const removed = existing.filter((item) => fromCampaign(item) && !wanted.has(item.url));
  const ownMedia = existing.filter((item) => !fromCampaign(item));
  const added = files.filter((file) => !byUrl.has(file.url));

  if (removed.length) {
    const { error } = await supabase
      .from("project_media")
      .delete()
      .in(
        "id",
        removed.map((item) => item.id),
      );
    if (error) throw readable(error.message);
  }

  // Campaign files first, in campaign order; the owner's own media after them.
  const results = await Promise.all([
    ...files.map((file, index) => {
      const row = byUrl.get(file.url);
      return row
        ? supabase.from("project_media").update({ sort_order: index }).eq("id", row.id)
        : supabase.from("project_media").insert(mediaRow(projectId, file, index));
    }),
    ...ownMedia.map((item, index) =>
      supabase
        .from("project_media")
        .update({ sort_order: files.length + index })
        .eq("id", item.id),
    ),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw readable(failed.error.message);

  return { added: added.length, removed: removed.length };
}
