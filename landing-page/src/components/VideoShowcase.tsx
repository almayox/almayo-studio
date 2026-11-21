"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import type { ShowItem } from "@/components/projectMedia";

type Channel = { name: string; logo: string | null; href: string | null };

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Glyph({ name }: { name: "play" | "pause" | "sound" | "muted" | "full" }) {
  const paths: Record<string, ReactNode> = {
    play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" />,
    pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
    sound: (
      <path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a4 4 0 0 0-2-3.46v6.92a4 4 0 0 0 2-3.46zm-2-8.2v2.1a6.5 6.5 0 0 1 0 12.2v2.1a8.5 8.5 0 0 0 0-16.4z" />
    ),
    muted: (
      <path d="M4 9v6h4l5 4V5L8 9H4zm17 .4L19.6 8 17 10.6 14.4 8 13 9.4l2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4-2.6-2.6L21 9.4z" />
    ),
    full: <path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 0h2v5h-5v-2h3v-3z" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      {paths[name]}
    </svg>
  );
}

/**
 * A player for an uploaded video: red progress bar, play, sound, time and full
 * screen. Reports whether the video is upright so the frame can fit it.
 */
function FilePlayer({
  item,
  autoPlay,
  onShape,
}: {
  item: ShowItem;
  autoPlay: boolean;
  onShape: (vertical: boolean) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(0);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  function seek(event: PointerEvent<HTMLDivElement>) {
    const el = video.current;
    if (!el || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    el.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * duration;
  }

  function fullScreen() {
    if (document.fullscreenElement) return void document.exitFullscreen();
    const el = frame.current;
    if (el?.requestFullscreen) return void el.requestFullscreen().catch(() => undefined);
    // iPhones only allow the video itself to go full screen.
    (video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)
      ?.webkitEnterFullscreen?.();
  }

  const buttonClass =
    "flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15";

  return (
    <div ref={frame} className="group relative h-full w-full bg-black">
      <video
        ref={video}
        src={item.poster ? item.url : `${item.url}#t=0.1`}
        poster={item.poster || undefined}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onProgress={(event) => {
          const el = event.currentTarget;
          if (el.buffered.length) setLoaded(el.buffered.end(el.buffered.length - 1));
        }}
        onLoadedMetadata={(event) => {
          const el = event.currentTarget;
          setDuration(el.duration);
          onShape(el.videoHeight > el.videoWidth);
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      {playing ? null : (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition hover:scale-105"
        >
          <Glyph name="play" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10 transition-opacity ${
          playing ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100" : "opacity-100"
        }`}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position in the video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${clock(time)} of ${clock(duration)}`}
          onPointerDown={seek}
          onPointerMove={(event) => {
            if (event.buttons === 1) seek(event);
          }}
          onKeyDown={(event) => {
            const el = video.current;
            if (!el) return;
            if (event.key === "ArrowRight") el.currentTime += 5;
            else if (event.key === "ArrowLeft") el.currentTime -= 5;
          }}
          className="group/bar flex h-4 cursor-pointer touch-none items-center"
        >
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover/bar:h-1.5">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/40"
              style={{ width: `${duration ? (loaded / duration) * 100 : 0}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-red-600"
              style={{ width: `${duration ? (time / duration) * 100 : 0}%` }}
            >
              <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-600 opacity-0 transition group-hover/bar:opacity-100" />
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={buttonClass}>
            <Glyph name={playing ? "pause" : "play"} />
          </button>
          <button
            type="button"
            onClick={() => {
              const el = video.current;
              if (!el) return;
              el.muted = !el.muted;
              setMuted(el.muted);
            }}
            aria-label={muted ? "Turn sound on" : "Mute"}
            className={buttonClass}
          >
            <Glyph name={muted ? "muted" : "sound"} />
          </button>
          <span className="ml-1 text-xs tabular-nums text-white/90">
            {clock(time)} / {clock(duration)}
          </span>
          <button type="button" onClick={fullScreen} aria-label="Full screen" className={`ml-auto ${buttonClass}`}>
            <Glyph name="full" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelAvatar({ channel }: { channel: Channel }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy text-white">
      {channel.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={channel.logo} alt="" className="h-full w-full bg-white object-contain" />
      ) : (
        channel.name.slice(0, 1)
      )}
    </span>
  );
}

/**
 * A project shown as a video page: one large player, its title and the client
 * under it, and the project's other videos listed beside it. Wide videos get a
 * wide frame and vertical ones (Shorts, reels) a tall one.
 */
export function VideoShowcase({
  videos,
  title,
  channel,
}: {
  videos: ShowItem[];
  title: string;
  channel: Channel;
}) {
  const [active, setActive] = useState(0);
  /** Set once the visitor picks a video, so that one starts playing by itself. */
  const [picked, setPicked] = useState(false);
  /** Shape of uploaded videos, learned when each one loads. */
  const [upright, setUpright] = useState<Record<string, boolean>>({});

  const current = videos[active];
  const isVertical = (item: ShowItem) => (item.kind === "youtube" ? item.short : Boolean(upright[item.id]));
  const nameOf = (item: ShowItem, index: number) =>
    item.caption || (videos.length > 1 ? `${title} · Part ${index + 1}` : title);
  const vertical = isVertical(current);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <div className="flex justify-center overflow-hidden rounded-2xl bg-black">
          {/* Wide: fills the column. Vertical: as tall as the screen allows, centred on black. */}
          <div
            className={vertical ? "aspect-[9/16] h-[min(78dvh,46rem)] max-w-full" : "aspect-video w-full"}
          >
            {current.kind === "youtube" && current.youtubeId ? (
              <YouTubeEmbed
                key={current.id}
                id={current.youtubeId}
                title={nameOf(current, active)}
                autoplay={picked}
              />
            ) : (
              <FilePlayer
                key={current.id}
                item={current}
                autoPlay={picked}
                onShape={(value) =>
                  setUpright((known) =>
                    known[current.id] === value ? known : { ...known, [current.id]: value },
                  )
                }
              />
            )}
          </div>
        </div>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl text-navy sm:text-2xl">
          {nameOf(current, active)}
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <ChannelAvatar channel={channel} />
          <div className="min-w-0">
            {channel.href ? (
              <a href={channel.href} className="block truncate text-sm font-semibold text-navy hover:underline">
                {channel.name}
              </a>
            ) : (
              <p className="truncate text-sm font-semibold text-navy">{channel.name}</p>
            )}
            <p className="text-xs text-navy/55">
              {videos.length} {videos.length === 1 ? "video" : "videos"}
            </p>
          </div>
        </div>
      </div>

      {videos.length > 1 ? (
        <ol className="flex flex-col gap-2">
          {videos.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setActive(index);
                  setPicked(true);
                }}
                aria-current={index === active}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                  index === active ? "bg-navy/5" : "hover:bg-navy/5"
                }`}
              >
                <span className="relative flex aspect-video w-36 shrink-0 justify-center overflow-hidden rounded-lg bg-black">
                  {item.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.poster}
                      alt=""
                      className={`h-full ${isVertical(item) ? "w-auto" : "w-full"} object-cover`}
                    />
                  ) : item.kind === "video" ? (
                    <video
                      src={`${item.url}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        const el = event.currentTarget;
                        const value = el.videoHeight > el.videoWidth;
                        setUpright((known) =>
                          known[item.id] === value ? known : { ...known, [item.id]: value },
                        );
                      }}
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                  {isVertical(item) ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Short
                    </span>
                  ) : null}
                  {index === active ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-red-600" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-medium text-navy">{nameOf(item, index)}</span>
                  <span className="mt-0.5 block truncate text-xs text-navy/55">{channel.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
