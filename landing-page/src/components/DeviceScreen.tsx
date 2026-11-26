"use client";

import { useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/RemoteImage";

/** Taller than this (width ÷ height) is one phone screen; below it, a whole page. */
const PHONE_SHAPE = 0.42;

type Frame = "browser" | "phone" | "page";

function frameFor(ratio: number, device?: "laptop" | "phone" | null): Frame {
  if (device === "phone") return "phone";
  if (ratio >= 1) return "browser";
  // On a laptop, anything taller than the screen scrolls inside the window.
  if (device === "laptop") return "page";
  return ratio >= PHONE_SHAPE ? "phone" : "page";
}

/**
 * A screenshot or screen recording of a website or app, shown on the device it
 * was made for. The shape of the file decides the frame:
 *
 * - wide: a browser window;
 * - tall, like a phone screen: a phone;
 * - many screens tall (a full-page screenshot): a browser window the visitor
 *   scrolls inside, as they would on the real site.
 */
export function DeviceScreen({
  src,
  alt,
  video = false,
  poster,
  address,
  device,
}: {
  src: string;
  alt: string;
  video?: boolean;
  poster?: string | null;
  /** Shown in the browser window's address bar, e.g. "example.com". */
  address?: string | null;
  /** Set by the owner when the shape alone would pick the wrong device. */
  device?: "laptop" | "phone" | null;
}) {
  // Unknown until the file reports its size; no device is drawn before that,
  // so a phone screen never flashes up inside a laptop first.
  const [measured, setMeasured] = useState<number | null>(null);
  const ratio = measured ?? 16 / 10;
  const holder = useRef<HTMLDivElement>(null);

  function measure(width: number, height: number) {
    if (!width || !height) return;
    const next = width / height;
    setMeasured((current) =>
      current !== null && Math.abs(current - next) < 0.001 ? current : next,
    );
  }

  // The image may already be loaded by the time the page becomes interactive.
  useEffect(() => {
    if (video) return;
    const image = holder.current?.querySelector("img");
    if (!image) return;
    const read = () => measure(image.naturalWidth, image.naturalHeight);
    read();
    image.addEventListener("load", read);
    return () => image.removeEventListener("load", read);
  }, [src, video]);

  const frame = frameFor(ratio, device);

  const screen = video ? (
    <video
      ref={(element) => {
        if (element) measure(element.videoWidth, element.videoHeight);
      }}
      onLoadedMetadata={(event) =>
        measure(event.currentTarget.videoWidth, event.currentTarget.videoHeight)
      }
      src={src}
      poster={poster || undefined}
      // A recording plays silently by itself, like a live screen.
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <RemoteImage
      src={src}
      alt={alt}
      fill
      sizes={frame === "phone" ? "360px" : "(min-width: 1152px) 1104px, 100vw"}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );

  if (measured === null) {
    return (
      <div
        ref={holder}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-navy/5 [&>*]:opacity-0"
      >
        {screen}
      </div>
    );
  }

  if (frame === "phone") {
    // A whole page captured at phone width scrolls inside a phone of the usual shape.
    const longPage = ratio < PHONE_SHAPE;
    const shape = longPage ? 9 / 19.5 : ratio;
    return (
      // A generic phone: a metal edge, a dark bezel, side buttons and a camera cut-out.
      <div
        ref={holder}
        className="relative shrink-0"
        style={{ width: `min(100%, calc(var(--media-row) * ${shape} + 1.25rem))` }}
      >
        <span aria-hidden className="absolute -left-[3px] top-[17%] h-[4%] w-[3px] rounded-l-sm bg-slate-500" />
        <span aria-hidden className="absolute -left-[3px] top-[25%] h-[8%] w-[3px] rounded-l-sm bg-slate-500" />
        <span aria-hidden className="absolute -left-[3px] top-[35%] h-[8%] w-[3px] rounded-l-sm bg-slate-500" />
        <span aria-hidden className="absolute -right-[3px] top-[28%] h-[12%] w-[3px] rounded-r-sm bg-slate-500" />
        <div className="rounded-[2.6rem] bg-gradient-to-b from-slate-400 via-slate-600 to-slate-400 p-[2px] shadow-2xl shadow-navy/25">
          <div className="rounded-[2.5rem] bg-black p-2">
            <div
              className="relative overflow-hidden rounded-[2rem] bg-white"
              style={{ aspectRatio: shape }}
            >
              {longPage ? (
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={`${alt}: scroll to see the whole page`}
                  className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <div className="relative w-full" style={{ aspectRatio: ratio }}>
                    {screen}
                  </div>
                </div>
              ) : (
                screen
              )}
              <span
                aria-hidden
                className="absolute left-1/2 top-[1.4%] h-[2.6%] w-[26%] -translate-x-1/2 rounded-full bg-black"
              />
              {/* A soft reflection across the glass. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/10"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wide screens and full pages sit in a browser window on a laptop.
  return (
    <div ref={holder} className="w-full">
      <div className="mx-[4%] rounded-t-2xl bg-gradient-to-b from-slate-500 to-slate-700 p-[2px] shadow-2xl shadow-navy/20">
        <div className="rounded-t-[0.9rem] bg-black p-2 pb-2.5 sm:p-3">
          <span aria-hidden className="mx-auto mb-1.5 block h-1 w-1 rounded-full bg-slate-700 sm:mb-2" />
          <div className="overflow-hidden rounded-md bg-white">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2 sm:gap-3">
              <span className="flex shrink-0 gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-[#f26b5e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#f5bd4f]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#5fc454]" />
              </span>
              <span className="hidden shrink-0 gap-2 text-sm leading-none text-slate-400 sm:flex" aria-hidden>
                <span>‹</span>
                <span>›</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                <svg aria-hidden viewBox="0 0 12 14" className="h-2.5 w-2.5 shrink-0 fill-slate-400">
                  <path d="M3 6V4a3 3 0 1 1 6 0v2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1Zm1.5 0h3V4a1.5 1.5 0 0 0-3 0v2Z" />
                </svg>
                <span className="truncate">{address || alt}</span>
              </span>
              {/* Keeps the address centred against the controls on the left. */}
              <span className="w-10 shrink-0 sm:w-20" aria-hidden />
            </div>
            {frame === "page" ? (
              <div className="relative">
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={`${alt}: scroll to see the whole page`}
                  className="aspect-[4/5] overflow-y-auto sm:aspect-[16/10]"
                >
                  <div className="relative w-full" style={{ aspectRatio: ratio }}>
                    {screen}
                  </div>
                </div>
                <span className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="rounded-full bg-navy/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
                    ↕ Scroll inside to see the page
                  </span>
                </span>
              </div>
            ) : (
              <div className="relative w-full" style={{ aspectRatio: ratio }}>
                {screen}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* The laptop's base, a little wider than the lid, with the lip used to open it. */}
      <div aria-hidden className="relative h-3 rounded-b-2xl bg-gradient-to-b from-slate-300 to-slate-400 shadow-lg shadow-navy/20 sm:h-4">
        <span className="absolute left-1/2 top-0 h-1.5 w-[14%] -translate-x-1/2 rounded-b-lg bg-slate-400/90" />
      </div>
    </div>
  );
}
