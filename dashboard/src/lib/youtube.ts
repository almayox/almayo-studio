/** What a pasted YouTube link points to. A Short is vertical, anything else is wide. */
export type YouTubeLink = { id: string; short: boolean };

const ID = /^[A-Za-z0-9_-]{6,20}$/;

/** Understands watch, youtu.be, shorts, embed and live links. Null for anything else. */
export function parseYouTubeLink(value: string | null | undefined): YouTubeLink | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  let short = false;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (parts[0] === "shorts") {
      id = parts[1] ?? null;
      short = true;
    } else if (parts[0] === "embed" || parts[0] === "live") id = parts[1] ?? null;
  }
  return id && ID.test(id) ? { id, short } : null;
}

export function youTubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
