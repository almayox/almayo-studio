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

/** A social media post: one item, or several swiped through as a carousel. */
export type ShowPost = { id: string; items: ShowItem[] };

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

/** Groups media into posts: items sharing a group key are one carousel, in gallery order. */
export function toShowPosts(media: ProjectMedia[]): ShowPost[] {
  const keys = new Map(media.map((item) => [item.id, item.group_key || null]));
  const posts: ShowPost[] = [];
  const byKey = new Map<string, ShowPost>();
  for (const item of toShowItems(media)) {
    const key = keys.get(item.id);
    const existing = key ? byKey.get(key) : undefined;
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const post = { id: item.id, items: [item] };
    posts.push(post);
    if (key) byKey.set(key, post);
  }
  return posts;
}
