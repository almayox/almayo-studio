"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { ProtectedMedia } from "./ProtectedMedia";
import { Composer } from "./Composer";
import { VoiceNote } from "./VoiceNote";
import type { ReviewComment, ReviewPost } from "./types";

const TYPE_LABELS: Record<string, string> = {
  single: "Image",
  carousel: "Carousel",
  reel: "Reel",
  video: "Reel",
  story: "Story",
};

export const APPROVAL_LABELS: Record<string, string> = {
  pending: "Waiting for your answer",
  approved: "Approved",
  changes_requested: "Changes requested",
};

/** "2026-12-02" becomes "2 Dec 2026"; anything else is shown as written. */
function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** One post opened from the grid: media, caption, the client's answer and comments. */
export function ReviewPostDialog({
  post,
  profileName,
  profileLogo,
  position,
  total,
  comments,
  released,
  open,
  busy,
  error,
  onAnswer,
  onComment,
  onStep,
  onClose,
}: {
  post: ReviewPost;
  /** Name and picture of the account the post is for. */
  profileName: string;
  profileLogo: string | null;
  position: number;
  total: number;
  comments: ReviewComment[];
  released: boolean;
  /** False once the review is locked: everything is read-only. */
  open: boolean;
  busy: boolean;
  error: string | null;
  onAnswer: (status: "approved" | "changes_requested") => void;
  /** Resolves to true when the comment was posted. */
  onComment: (body: string, audio: Blob | null) => Promise<boolean>;
  onStep: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const count = post.media.length;
  const current = Math.max(0, Math.min(slide, count - 1));
  const media = post.media[current];
  const trackRef = useRef<HTMLDivElement>(null);

  // Keeps the same slide in view when the dialog changes width (rotating a phone).
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(() => {
      track.scrollLeft = currentRef.current * track.clientWidth;
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  /** Slides the carousel to a slide; the scroll position then updates the dots. */
  function goToSlide(index: number) {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Holds the page behind still while the post is open. "overflow: hidden" alone
  // does not stop phones scrolling it, so the page is pinned where it was.
  useEffect(() => {
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      Object.assign(body.style, previous);
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Keeps the newest message in view, as a chat does.
  const listRef = useRef<HTMLUListElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const seenCount = useRef(comments.length);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    // On phones the whole post scrolls as one, so a new message is brought into view there.
    if (comments.length > seenCount.current) {
      endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    seenCount.current = comments.length;
  }, [comments.length]);

  const shownError = recorderError || error;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close post"
        onClick={onClose}
        className="absolute inset-0 bg-navy-deep/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Post ${position + 1} of ${total}`}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-mist px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous post"
              disabled={position === 0}
              onClick={() => onStep(-1)}
              className="rounded-lg p-2 text-navy hover:bg-foam disabled:opacity-30"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <p className="text-sm font-medium text-navy">
              Post {position + 1} of {total}
            </p>
            <button
              type="button"
              aria-label="Next post"
              disabled={position === total - 1}
              onClick={() => onStep(1)}
              className="rounded-lg p-2 text-navy hover:bg-foam disabled:opacity-30"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-navy/60 hover:bg-foam hover:text-navy"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* On phones this is the only part that scrolls, so a swipe is never caught by a box inside it. */}
        <div className="grid min-h-0 overflow-y-auto overscroll-contain md:grid-cols-2">
          <div className="bg-white">
            {/* The post as it appears in a feed: who posted, the media, the dots. */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy text-sm font-semibold text-white ring-1 ring-mist">
                {profileLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileLogo} alt="" className="h-full w-full bg-white object-contain" />
                ) : (
                  profileName.charAt(0).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-navy">
                  {profileName}
                </span>
                <span className="block truncate text-xs text-navy/55">
                  {post.platforms || TYPE_LABELS[post.type] || post.type}
                </span>
              </span>
            </div>

            {count ? (
              <div className="relative bg-foam">
                {/* Swipe sideways to move between slides; each one snaps into place. */}
                <div
                  ref={trackRef}
                  dir="ltr"
                  onScroll={(event) => {
                    const track = event.currentTarget;
                    if (track.clientWidth) setSlide(Math.round(track.scrollLeft / track.clientWidth));
                  }}
                  className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {post.media.map((item, index) => (
                    <div
                      key={item.id}
                      role="group"
                      aria-label={count > 1 ? `Slide ${index + 1} of ${count}` : undefined}
                      className="w-full shrink-0 snap-center snap-always"
                    >
                      <ProtectedMedia
                        media={item}
                        alt={post.title}
                        released={released}
                        controls
                        contain
                        className="aspect-[3/4] w-full max-md:max-h-[64dvh]"
                      />
                    </div>
                  ))}
                </div>

                {count > 1 ? (
                  <>
                    <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-navy-deep/70 px-2.5 py-1 text-xs font-medium text-white">
                      {current + 1}/{count}
                    </span>
                    <button
                      type="button"
                      aria-label="Previous slide"
                      disabled={current === 0}
                      onClick={() => goToSlide(current - 1)}
                      className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-navy shadow disabled:hidden md:block"
                    >
                      <ChevronLeft size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Next slide"
                      disabled={current === count - 1}
                      onClick={() => goToSlide(current + 1)}
                      className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-navy shadow disabled:hidden md:block"
                    >
                      <ChevronRight size={18} aria-hidden />
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center bg-mist/40 text-sm text-navy/50">
                No media
              </div>
            )}

            {count > 1 ? (
              <div className="flex justify-center gap-1.5 py-3">
                {post.media.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={index === current}
                    onClick={() => goToSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === current ? "w-4 bg-navy" : "w-1.5 bg-navy/25"
                    }`}
                  />
                ))}
              </div>
            ) : null}

            {media?.downloadUrl ? (
              <a
                href={media.downloadUrl}
                className="mx-auto mb-3 mt-1 flex w-fit items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white"
              >
                <Download size={14} aria-hidden /> Download original
                {count > 1 ? ` (slide ${current + 1})` : ""}
              </a>
            ) : null}
          </div>

          {/* On wide screens this column is exactly as tall as the image beside it. */}
          <div className="md:relative">
            <div className="flex flex-col gap-4 p-5 md:absolute md:inset-0">
              <div className="shrink-0 md:max-h-44 md:overflow-y-auto">
                {post.caption ? (
                  <p dir="auto" className="whitespace-pre-wrap text-sm text-navy/85">
                    <span className="font-semibold text-navy">{profileName}</span>{" "}
                    {post.caption}
                  </p>
                ) : (
                  <p className="text-sm text-navy/40">No caption.</p>
                )}
                {post.hashtags ? (
                  <p dir="auto" className="mt-1.5 text-sm text-navy/55">
                    {post.hashtags}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] uppercase tracking-wide text-navy/45">
                  {[
                    TYPE_LABELS[post.type] || post.type,
                    post.publish_date ? `Posting on ${formatDate(post.publish_date)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="shrink-0">
                <p className="text-xs font-medium uppercase tracking-wide text-navy/45">
                  {APPROVAL_LABELS[post.approval_status] ||
                    post.approval_status}
                </p>
                {open ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["approved", "Approve"],
                        ["changes_requested", "Request changes"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={busy}
                        aria-pressed={post.approval_status === value}
                        onClick={() => onAnswer(value)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                          post.approval_status === value
                            ? value === "approved"
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-500 text-white"
                            : "bg-foam text-navy ring-1 ring-mist hover:bg-mist/50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {open &&
                post.approval_status === "changes_requested" &&
                comments.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    Tell me what to change below: type a message or tap the
                    microphone.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col rounded-2xl border border-mist md:min-h-0 md:overflow-hidden">
                <p className="shrink-0 border-b border-mist px-4 py-2 text-xs font-medium uppercase tracking-wide text-navy/45">
                  Comments ({comments.length})
                </p>
                <ul
                  ref={listRef}
                  className="flex-1 space-y-1.5 px-3 py-3 md:overflow-y-auto"
                >
                  {comments.length === 0 ? (
                    <li className="py-6 text-center text-sm text-navy/40">
                      {open
                        ? "No comments yet. Write a message or record a voice note."
                        : "No comments."}
                    </li>
                  ) : null}
                  {comments.map((comment) => {
                    // The reviewer's own messages sit on the right, the studio's on the left.
                    const mine = !comment.from_studio;
                    return (
                      <li
                        key={comment.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                            mine
                              ? "rounded-br-md bg-navy text-white"
                              : "rounded-bl-md bg-foam text-navy ring-1 ring-mist"
                          }`}
                        >
                          <p
                            className={`text-[11px] font-semibold ${mine ? "text-white/70" : "text-navy/60"}`}
                          >
                            {comment.author_name}
                          </p>
                          {comment.audio_url ? (
                            <div className="mt-1">
                              <VoiceNote
                                src={comment.audio_url}
                                onDark={mine}
                              />
                            </div>
                          ) : null}
                          {comment.body ? (
                            <p
                              dir="auto"
                              className="mt-0.5 whitespace-pre-wrap break-words"
                            >
                              {comment.body}
                            </p>
                          ) : null}
                          <p
                            className={`mt-0.5 text-right text-[10px] ${
                              mine ? "text-white/60" : "text-navy/45"
                            }`}
                          >
                            {new Date(comment.created_at).toLocaleString(
                              undefined,
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  <li ref={endRef} aria-hidden />
                </ul>

                {open ? (
                  <div className="sticky bottom-0 shrink-0 rounded-b-2xl border-t border-mist bg-white p-2.5">
                    <Composer
                      busy={busy}
                      onSend={onComment}
                      onError={setRecorderError}
                    />
                  </div>
                ) : null}
              </div>

              {shownError ? (
                <p
                  role="alert"
                  className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {shownError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
