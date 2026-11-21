"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SendHorizontal, Trash2 } from "lucide-react";
import { DropUpload } from "@/components/DropUpload";
import { StorageImage, StorageVideo } from "@/components/StorageMedia";
import { VoiceNote } from "@/components/campaigns/VoiceNote";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/PageChrome";
import { PlatformPicker } from "@/components/campaigns/PlatformPicker";
import {
  POST_KINDS,
  deleteAsset,
  fileFitsKind,
  isVideoUrl,
  logCampaignEvent,
  parsePlatforms,
  postKind,
  readableDbError,
  addSlidesToPost,
  moveItem,
  saveSortOrder,
  uploadPostMedia,
  type AssetRow,
} from "@/lib/campaigns";
import { bySortOrder } from "@/lib/lineItems";
import { playChatSound } from "@/lib/chatSounds";
import { createClient } from "@/lib/supabase/client";

const APPROVALS = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes requested" },
];

function Media({ src, video }: { src: string; video: boolean }) {
  const className = "aspect-[4/5] w-full rounded-xl bg-subtle object-contain";
  return video ? (
    <StorageVideo src={src} controls playsInline preload="metadata" className={className} />
  ) : (
    <StorageImage src={src} alt="" className={className} />
  );
}

/** One post: media and slides, caption, client status and the comment thread. */
export function PostEditor({
  asset,
  campaignId,
  position,
  total,
  platformOptions,
  locked,
  onClose,
}: {
  asset: AssetRow;
  campaignId: string;
  /** Index of the post in the grid. */
  position: number;
  total: number;
  /** The campaign's platforms, offered per post. */
  platformOptions: string[];
  /** Approved campaigns are read-only apart from replies. */
  locked: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    caption: asset.caption || "",
    hashtags: asset.hashtags || "",
    publishDate: asset.publish_date || "",
    platforms: parsePlatforms(asset.platforms),
  });
  const [reply, setReply] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kind = postKind(asset);
  const kindLabel = POST_KINDS.find((item) => item.value === kind)?.label ?? "Post";
  const slides = bySortOrder(asset.campaign_asset_slides);
  const comments = (asset.campaign_comments || [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  // Keeps the newest message in view, as a chat does.
  const chatRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const chat = chatRef.current;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [comments.length]);

  const shown = slides.length ? slides[Math.min(slideIndex, slides.length - 1)] : null;
  const shownUrl = shown?.media_url ?? asset.media_url;
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  /** Runs one piece of work with a busy label, then reloads the data. */
  async function run(label: string, work: () => Promise<string | null | void>) {
    if (busy) return;
    setBusy(label);
    setError(null);
    try {
      const problem = await work();
      if (problem) setError(problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  const updateAsset = async (values: Record<string, unknown>) => {
    const { error: updateError } = await createClient()
      .from("campaign_assets")
      .update(values)
      .eq("id", asset.id);
    return updateError ? readableDbError(updateError.message) : null;
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const platforms = form.platforms.join(", ");
    run("Saving…", async () => {
      const problem = await updateAsset({
        caption: form.caption.trim() || null,
        hashtags: form.hashtags.trim() || null,
        publish_date: form.publishDate || null,
        ...(platforms === (asset.platforms || "") ? {} : { platforms: platforms || null }),
      });
      if (!problem) onClose();
      return problem;
    });
  }

  function replaceMedia(files: FileList) {
    const file = files[0];
    if (!file) return;
    if (!fileFitsKind(file, kind)) {
      return setError(kind === "reel" ? "A reel takes one video." : "An image post takes one image.");
    }
    run("Uploading…", async () => {
      const { url, previewUrl } = await uploadPostMedia(campaignId, file, setBusy);
      return updateAsset({ media_url: url, thumbnail_url: url, preview_url: previewUrl });
    });
  }

  function addSlides(files: FileList) {
    const list = Array.from(files).filter((file) => fileFitsKind(file, "carousel"));
    if (!list.length) return setError("A carousel takes images and videos only.");
    run("Uploading…", () =>
      addSlidesToPost(createClient(), campaignId, asset, list, setBusy),
    );
  }

  /** Drops the dragged slide at `to` and keeps the first slide as the post's cover. */
  function moveSlide(to: number) {
    const from = slides.findIndex((slide) => slide.id === draggedSlideId);
    setDraggedSlideId(null);
    if (from < 0 || from === to) return;
    const ordered = moveItem(slides, from, to);
    setSlideIndex(to);
    run("Saving…", async () => {
      const problem = await saveSortOrder(createClient(), "campaign_asset_slides", ordered);
      if (problem || ordered[0].media_url === asset.media_url) return problem;
      return updateAsset({
        media_url: ordered[0].media_url,
        thumbnail_url: ordered[0].media_url,
        preview_url: ordered[0].preview_url ?? null,
      });
    });
  }

  function removeSlide(slideId: string) {
    if (slides.length <= 2) return setError("A carousel needs at least two slides.");
    run("Removing…", async () => {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("campaign_asset_slides")
        .delete()
        .eq("id", slideId);
      if (deleteError) return deleteError.message;
      const remaining = slides.filter((slide) => slide.id !== slideId);
      setSlideIndex(0);
      // The first slide is the post's cover in the grid.
      const first = remaining[0];
      if (!first || first.media_url === asset.media_url) return null;
      return updateAsset({
        media_url: first.media_url,
        thumbnail_url: first.media_url,
        preview_url: first.preview_url ?? null,
      });
    });
  }

  function sendReply() {
    const body = reply.trim();
    if (!body) return;
    playChatSound("send");
    run("Sending…", async () => {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("campaign_comments").insert({
        asset_id: asset.id,
        author_name: "Almayo Studio",
        body,
        from_studio: true,
      });
      if (insertError) return insertError.message;
      setReply("");
      await logCampaignEvent(supabase, campaignId, "comment", `${asset.title}: ${body}`);
      return null;
    });
  }

  function removePost() {
    if (!window.confirm("Delete this post with its slides and comments?")) return;
    run("Deleting…", async () => {
      const problem = await deleteAsset(createClient(), asset.id);
      if (!problem) onClose();
      return problem;
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${kindLabel} · post ${position + 1} of ${total}`}
      description={busy ?? "What the client sees for this post."}
      extraWide
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {shownUrl ? (
            <Media
              key={shownUrl}
              src={shownUrl}
              video={shown ? isVideoUrl(shownUrl) : kind === "reel"}
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-subtle text-xs text-fg/50">
              No media
            </div>
          )}

          {slides.length ? (
            <div className="grid grid-cols-5 gap-1.5">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable={!locked && !busy}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedSlideId(slide.id);
                  }}
                  onDragEnd={() => setDraggedSlideId(null)}
                  onDragOver={(event) => {
                    if (draggedSlideId) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveSlide(index);
                  }}
                  className={`relative ${locked ? "" : "cursor-grab"} ${
                    draggedSlideId === slide.id ? "opacity-40" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Show slide ${index + 1}`}
                    onClick={() => setSlideIndex(index)}
                    className={`block w-full overflow-hidden rounded-md ring-2 ${
                      index === slideIndex ? "ring-fg" : "ring-transparent"
                    }`}
                  >
                    {isVideoUrl(slide.media_url) ? (
                      <StorageVideo
                        src={slide.media_url}
                        muted
                        preload="metadata"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <StorageImage
                        src={slide.media_url}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                    )}
                  </button>
                  {locked ? null : (
                    <button
                      type="button"
                      aria-label={`Remove slide ${index + 1}`}
                      onClick={() => removeSlide(slide.id)}
                      className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 text-white"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {slides.length > 1 && !locked ? (
            <p className="text-[11px] text-fg/50">Drag slides to reorder. The first is the cover.</p>
          ) : null}

          {locked ? null : kind === "carousel" ? (
            <DropUpload
              onFiles={addSlides}
              accept="image/*,video/*"
              multiple
              disabled={Boolean(busy)}
              className="block rounded-lg border border-dashed border-line px-2 py-2 text-center text-xs text-fg/65 hover:text-fg"
            >
              Add images or videos
            </DropUpload>
          ) : (
            <DropUpload
              onFiles={replaceMedia}
              accept={kind === "reel" ? "video/*" : "image/*"}
              disabled={Boolean(busy)}
              className="block rounded-lg border border-dashed border-line px-2 py-2 text-center text-xs text-fg/65 hover:text-fg"
            >
              {kind === "reel" ? "Replace video" : "Replace image"}
            </DropUpload>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <form id="post-form" onSubmit={onSubmit} className="space-y-3">
            <label className={labelClass}>
              Caption
              <textarea
                rows={4}
                value={form.caption}
                disabled={locked}
                onChange={(e) => set({ caption: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Hashtags
              <input
                value={form.hashtags}
                disabled={locked}
                onChange={(e) => set({ hashtags: e.target.value })}
                placeholder="#brand #campaign"
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Posting date (optional)
              <input
                type="date"
                value={form.publishDate}
                disabled={locked}
                onChange={(e) => set({ publishDate: e.target.value })}
                className={fieldClass}
              />
            </label>
            {platformOptions.length || form.platforms.length ? (
              <div className={labelClass}>
                Platforms for this post (optional)
                <PlatformPicker
                  options={platformOptions}
                  value={form.platforms}
                  onChange={(platforms) => set({ platforms })}
                  disabled={locked}
                />
              </div>
            ) : null}
          </form>

          <div>
            <p className="text-xs font-medium text-fg/65">Client&apos;s answer</p>
            <p className="mt-0.5 text-[11px] text-fg/45">
              The client sets this on the review page. Change it yourself only if they answered
              you somewhere else, for example on WhatsApp.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {APPROVALS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={locked || Boolean(busy)}
                  aria-pressed={asset.approval_status === option.value}
                  onClick={() =>
                    run("Saving…", () => updateAsset({ approval_status: option.value }))
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    asset.approval_status === option.value
                      ? "border-fg bg-fg text-canvas"
                      : "border-line bg-subtle text-fg/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-line">
            <p className="border-b border-line px-4 py-2 text-xs font-medium text-fg/65">
              Comments ({comments.length})
            </p>
            <ul ref={chatRef} className="max-h-72 space-y-1.5 overflow-y-auto px-3 py-3">
              {comments.length === 0 ? (
                <li className="py-4 text-center text-xs text-fg/45">No comments yet.</li>
              ) : null}
              {comments.map((comment) => {
                // Your replies sit on the right, the client's messages on the left.
                const mine = Boolean(comment.from_studio);
                return (
                  <li key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine ? "rounded-br-md bg-fg text-canvas" : "rounded-bl-md bg-subtle text-fg"
                      }`}
                    >
                      <p
                        className={`text-[11px] font-semibold ${mine ? "text-canvas/65" : "text-fg/60"}`}
                      >
                        {comment.author_name}
                      </p>
                      {comment.audio_url ? (
                        <div className="mt-1">
                          <VoiceNote src={comment.audio_url} onDark={mine} />
                        </div>
                      ) : null}
                      {comment.body ? (
                        <p dir="auto" className="mt-0.5 whitespace-pre-wrap break-words">
                          {comment.body}
                        </p>
                      ) : null}
                      <p
                        className={`mt-0.5 text-right text-[10px] ${
                          mine ? "text-canvas/55" : "text-fg/45"
                        }`}
                      >
                        {new Date(comment.created_at).toLocaleString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 border-t border-line p-2.5">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="Message"
                aria-label="Reply to the client"
                dir="auto"
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-subtle px-4 text-sm text-fg outline-none placeholder:text-fg/40 focus:border-fg/40"
              />
              <button
                type="button"
                onClick={sendReply}
                disabled={Boolean(busy) || !reply.trim()}
                aria-label="Send reply"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fg text-canvas transition disabled:opacity-40"
              >
                <SendHorizontal size={18} aria-hidden />
              </button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {locked ? null : (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
              <button
                type="button"
                onClick={removePost}
                disabled={Boolean(busy)}
                className="inline-flex h-[var(--control-h)] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden /> Delete post
              </button>
              <button
                type="submit"
                form="post-form"
                disabled={Boolean(busy)}
                className={primaryBtnClass}
              >
                Save post
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
