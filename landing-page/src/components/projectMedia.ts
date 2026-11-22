import { parseYouTubeLink } from "@/lib/youtube";
import type { ProjectMedia } from "@/lib/types";

/** One thing to look at in a project: an image, an uploaded video, or a YouTube video. */
export type ShowItem = {
  id: string;
  kind: "image" | "video" | "youtube";
  /** The image or video file; unused for YouTube. */
  url: string;
  /** Thumbnail shown before a video plays. */
  poster: string | null;
  youtubeId: string | null;
  /** A vertical YouTube Short. */
  short: boolean;
  caption: string | null;
  /** Which part stays visible when the still picture is cropped, e.g. "30% 50%". */
  position: string | null;
};

/** How a post is marked in the grid. */
export type PostType = "post" | "carousel" | "reel";

/** A social media post: one item, or several swiped through as a carousel. */
export type ShowPost = { id: string; type: PostType; items: ShowItem[] };

/** Images and videos, in gallery order. */
export function toShowItems(media: ProjectMedia[]): ShowItem[] {
  return media.flatMap((item): ShowItem[] => {
    // PDFs open as books and 3D models in their own viewer; neither is a post or a video.
    if (item.media_type === "pdf" || item.media_type === "model") return [];
    const base = {
      id: item.id,
      url: item.url,
      poster: item.poster_url ?? null,
      caption: item.caption,
      position: item.poster_position ?? null,
    };
    if (item.media_type === "youtube") {
      const link = parseYouTubeLink(item.url);
      return link ? [{ ...base, kind: "youtube", youtubeId: link.id, short: link.short }] : [];
    }
    return [
      { ...base, kind: item.media_type === "video" ? "video" : "image", youtubeId: null, short: false },
    ];
  });
}

/** A post's kind worked out from its files. */
function autoType(items: ShowItem[]): PostType {
  if (items.length > 1) return "carousel";
  return items[0].kind === "image" ? "post" : "reel";
}

/**
 * Applies the kind chosen in the dashboard. A reel plays only its video, with
 * the post's image (if any) as the picture shown in the grid; a single post
 * shows only its first file.
 */
function withType(post: { id: string; items: ShowItem[] }, chosen: PostType | null): ShowPost {
  if (chosen === "reel") {
    const video = post.items.find((item) => item.kind !== "image");
    if (!video) return { ...post, type: autoType(post.items) };
    const still = post.items.find((item) => item.kind === "image");
    const poster = video.poster ?? still?.url ?? null;
    const position = video.poster ? video.position : (still?.position ?? video.position);
    return { id: post.id, type: "reel", items: [{ ...video, poster, position }] };
  }
  if (chosen === "post") return { id: post.id, type: "post", items: [post.items[0]] };
  return { ...post, type: chosen ?? autoType(post.items) };
}

/** Groups media into posts: items sharing a group key are one carousel, in gallery order. */
export function toShowPosts(media: ProjectMedia[]): ShowPost[] {
  const byId = new Map(media.map((item) => [item.id, item]));
  const posts: { id: string; items: ShowItem[] }[] = [];
  const byKey = new Map<string, { id: string; items: ShowItem[] }>();
  for (const item of toShowItems(media)) {
    const key = byId.get(item.id)?.group_key || null;
    const existing = key ? byKey.get(key) : undefined;
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const post = { id: item.id, items: [item] };
    posts.push(post);
    if (key) byKey.set(key, post);
  }
  // The choice is saved on the post's first item.
  return posts.map((post) => withType(post, byId.get(post.id)?.post_type ?? null));
}
