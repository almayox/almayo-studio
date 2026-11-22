"use client";

import { useEffect, useRef, useState } from "react";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import type { ShowItem, ShowPost } from "@/components/projectMedia";

type Profile = { name: string; logo: string | null; title: string; subtitle: string | null };

function Avatar({ profile, size }: { profile: Profile; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy font-semibold text-white ${size}`}
    >
      {profile.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logo} alt="" className="h-full w-full bg-white object-contain" />
      ) : (
        <span className="font-[family-name:var(--font-display)]">{profile.name.slice(0, 1)}</span>
      )}
    </span>
  );
}

/** The still picture of an item: the image, a video's thumbnail, or its first frame. */
function Still({ item, className }: { item: ShowItem; className: string }) {
  if (item.kind === "video" && !item.poster) {
    return <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.kind === "image" ? item.url : item.poster || ""}
      alt=""
      // Where the owner said the crop should sit; only matters when the picture is cropped.
      style={{ objectPosition: item.position || undefined }}
      className={className}
    />
  );
}

function Icon({ kind }: { kind: "carousel" | "video" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      {kind === "carousel" ? (
        <path d="M7 3h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7V3zM3 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      ) : (
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" />
      )}
    </svg>
  );
}

/** One slide of an opened post. Videos only load once their slide is the one on screen. */
function Slide({ item, active, title }: { item: ShowItem; active: boolean; title: string }) {
  if (item.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.caption || title} className="h-full w-full object-contain" />;
  }
  if (!active) return <Still item={item} className="h-full w-full object-contain" />;
  if (item.kind === "youtube" && item.youtubeId) return <YouTubeEmbed id={item.youtubeId} title={title} autoplay />;
  return <ReelVideo item={item} />;
}

/**
 * A video the way social media plays it: it starts by itself with sound,
 * repeats, and a tap pauses or resumes it. No control bar, only a thin
 * progress line and a sound button.
 */
function ReelVideo({ item }: { item: ShowItem }) {
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    // Browsers that refuse to start a video with sound get it muted instead.
    el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      el.play().catch(() => undefined);
    });
  }, []);

  function toggle() {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={video}
        src={item.url}
        poster={item.poster || undefined}
        loop
        playsInline
        preload="auto"
        onClick={toggle}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(event) => {
          const el = event.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
        className="h-full w-full cursor-pointer object-contain"
      />
      {paused ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
        >
          <Icon kind="video" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          const el = video.current;
          if (!el) return;
          el.muted = !el.muted;
          setMuted(el.muted);
        }}
        aria-label={muted ? "Turn sound on" : "Mute"}
        className="absolute bottom-4 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
          {muted ? (
            <path d="M4 9v6h4l5 4V5L8 9H4zm17 .4L19.6 8 17 10.6 14.4 8 13 9.4l2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4-2.6-2.6L21 9.4z" />
          ) : (
            <path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4 4 0 0 0-2-3.46v6.92a4 4 0 0 0 2-3.46zm-2-8.2v2.1a6.5 6.5 0 0 1 0 12.2v2.1a8.5 8.5 0 0 0 0-16.4z" />
          )}
        </svg>
      </button>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/25">
        <span className="block h-full bg-white" style={{ width: `${progress * 100}%` }} />
      </span>
    </div>
  );
}

/** An opened post: profile row on top, then the media, swiped sideways when it is a carousel. */
function PostDialog({
  post,
  profile,
  onClose,
  onStep,
}: {
  post: ShowPost;
  profile: Profile;
  onClose: () => void;
  /** Moves to the post before (-1) or after (1); null when there is none. */
  onStep: (dir: 1 | -1) => (() => void) | null;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const many = post.items.length > 1;
  // A lone vertical video gets a tall frame; everything else the usual post shape.
  const tall = !many && (post.items[0].kind === "video" || post.items[0].short);
  const ratio = tall ? 9 / 16 : 3 / 4;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const goToSlide = (index: number) =>
    track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: "smooth" });
  const prevPost = onStep(-1);
  const nextPost = onStep(1);
  const stepClass =
    "hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 sm:flex";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={profile.title}
      className="fixed inset-0 z-[100] flex items-center justify-center gap-4 bg-navy-deep/90 p-3 backdrop-blur-sm sm:p-6"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      {prevPost ? (
        <button type="button" onClick={prevPost} aria-label="Previous post" className={`relative ${stepClass}`}>
          ‹
        </button>
      ) : (
        <span className="hidden w-11 sm:block" />
      )}

      <div
        className="relative flex max-h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ width: `min(100%, 30rem, calc((100dvh - 9rem) * ${ratio}))` }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar profile={profile} size="h-9 w-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy">{profile.name}</p>
            {profile.subtitle ? (
              <p className="truncate text-xs text-navy/55">{profile.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-navy/60 transition hover:bg-navy/5 hover:text-navy"
          >
            ×
          </button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: ratio }}>
          <div
            ref={track}
            onScroll={(event) => {
              const el = event.currentTarget;
              setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
            className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {post.items.map((item, index) => (
              <div key={item.id} className="h-full w-full shrink-0 snap-center snap-always">
                <Slide item={item} active={index === slide} title={profile.title} />
              </div>
            ))}
          </div>
          {many ? (
            <>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                {slide + 1}/{post.items.length}
              </span>
              {slide > 0 ? (
                <button
                  type="button"
                  onClick={() => goToSlide(slide - 1)}
                  aria-label="Previous slide"
                  className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-navy shadow sm:flex"
                >
                  ‹
                </button>
              ) : null}
              {slide < post.items.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToSlide(slide + 1)}
                  aria-label="Next slide"
                  className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-navy shadow sm:flex"
                >
                  ›
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {many ? (
          <div className="flex justify-center gap-1.5 py-2.5">
            {post.items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Slide ${index + 1}`}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  index === slide ? "bg-navy" : "bg-navy/20"
                }`}
              />
            ))}
          </div>
        ) : null}
        {post.items[slide]?.caption ? (
          <p className="px-3 pb-3 text-sm text-navy/80">
            <span className="font-semibold text-navy">{profile.name}</span> {post.items[slide].caption}
          </p>
        ) : null}
      </div>

      {nextPost ? (
        <button type="button" onClick={nextPost} aria-label="Next post" className={`relative ${stepClass}`}>
          ›
        </button>
      ) : (
        <span className="hidden w-11 sm:block" />
      )}
    </div>
  );
}

/**
 * A project shown the way a social media profile shows its content: the
 * client's picture and name, then a grid of three. Tapping a post opens it.
 */
export function SocialGrid({ profile, posts }: { profile: Profile; posts: ShowPost[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const openPost = open === null ? null : posts[open];
  // Dashed places complete the last row, so the grid of three always reads as one.
  const empty = (3 - (posts.length % 3)) % 3;

  const carousels = posts.filter((post) => post.type === "carousel").length;
  const videos = posts.filter((post) => post.type === "reel").length;
  const stats = [
    { label: posts.length === 1 ? "Post" : "Posts", value: posts.length },
    { label: carousels === 1 ? "Carousel" : "Carousels", value: carousels },
    { label: videos === 1 ? "Video" : "Videos", value: videos },
  ];

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-mist bg-white shadow-sm">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
          {/* A coloured ring around the picture, as profiles have. */}
          <div className="shrink-0 rounded-full bg-gradient-to-tr from-accent via-accent/60 to-navy p-[3px]">
            <Avatar profile={profile} size="h-20 w-20 border-[3px] border-white text-3xl sm:h-24 sm:w-24" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-[family-name:var(--font-display)] text-2xl text-navy">
              {profile.name}
            </h2>
            <p className="mt-0.5 text-sm text-navy/55">
              {[profile.title, profile.subtitle].filter(Boolean).join(" · ")}
            </p>
          </div>

          <dl className="flex w-full justify-between gap-6 text-center sm:w-auto sm:justify-start sm:gap-9">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-[family-name:var(--font-display)] text-2xl text-navy">
                  {stat.value}
                </dd>
                <dt className="text-xs text-navy/55">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* The tab a profile's grid sits under. */}
      <div className="flex justify-center border-t border-mist">
        <span className="-mt-px flex items-center gap-2 border-t-2 border-navy px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
            <path d="M3 3h5v5H3zm6.5 0h5v5h-5zM16 3h5v5h-5zM3 9.5h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5zM3 16h5v5H3zm6.5 0h5v5h-5zm6.5 0h5v5h-5z" />
          </svg>
          Posts
        </span>
      </div>

      <div className="grid grid-cols-3 gap-0.5 bg-mist">
        {posts.map((post, index) => {
          const cover = post.items[0];
          const kind = post.type === "carousel" ? "carousel" : post.type === "reel" ? "video" : null;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`Open post ${index + 1}`}
              className="group relative aspect-[3/4] overflow-hidden bg-foam focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            >
              <Still
                item={cover}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              <span className="pointer-events-none absolute inset-0 bg-navy-deep/0 transition group-hover:bg-navy-deep/20" />
              {kind ? (
                <span className="absolute right-2 top-2 text-white drop-shadow">
                  <Icon kind={kind} />
                </span>
              ) : null}
            </button>
          );
        })}
        {Array.from({ length: empty }, (_, index) => (
          <div key={index} aria-hidden className="bg-white p-1">
            <div className="aspect-[3/4] w-full rounded-md border-2 border-dashed border-mist" />
          </div>
        ))}
      </div>

      {openPost && open !== null ? (
        <PostDialog
          // A new post starts again from its first slide.
          key={openPost.id}
          post={openPost}
          profile={profile}
          onClose={() => setOpen(null)}
          onStep={(dir) => (posts[open + dir] ? () => setOpen(open + dir) : null)}
        />
      ) : null}
    </section>
  );
}
