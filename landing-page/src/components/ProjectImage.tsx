"use client";

import { useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/RemoteImage";

/**
 * A project image shown whole, in its own shape: a wide banner stays wide and a
 * tall poster stays tall. The shape is read from the image once it loads.
 *
 * Images sit side by side in rows of one height (`--image-row`) and stretch
 * together to fill the row, like a photo gallery. Clicking one opens it large.
 */
export function ProjectImage({ src, alt }: { src: string; alt: string }) {
  // Until the image reports its size, hold a 4:3 place for it.
  const [ratio, setRatio] = useState(4 / 3);
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLButtonElement>(null);

  function measure(image: HTMLImageElement | null | undefined) {
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const next = image.naturalWidth / image.naturalHeight;
    setRatio((current) => (Math.abs(current - next) < 0.001 ? current : next));
  }

  // The image may already be loaded by the time the page becomes interactive.
  useEffect(() => {
    const image = frame.current?.querySelector("img");
    measure(image);
    if (!image) return;
    const onLoad = () => measure(image);
    image.addEventListener("load", onLoad);
    return () => image.removeEventListener("load", onLoad);
  }, [src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        ref={frame}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open image: ${alt}`}
        className="relative cursor-zoom-in overflow-hidden rounded-2xl bg-navy/5"
        style={{
          aspectRatio: ratio,
          // Grows in step with its shape, so every image in a row keeps the same height.
          flex: `${ratio} 1 calc(var(--image-row) * ${ratio})`,
          // An image left alone on the last row grows a little, not to the full width.
          maxWidth: `min(100%, calc(var(--image-row) * ${ratio} * 1.5))`,
        }}
      >
        <RemoteImage
          src={src}
          alt={alt}
          fill
          // A wide banner takes a whole row; other shapes share one.
          sizes={ratio > 2 ? "(min-width: 1152px) 1104px, 100vw" : "(min-width: 1152px) 720px, 100vw"}
          className="h-full w-full object-contain"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out flex-col bg-navy/95"
        >
          <div className="flex justify-end px-5 py-4 sm:px-8">
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(false)}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy transition hover:bg-white/85"
            >
              Close
            </button>
          </div>
          <div className="relative mx-4 mb-6 min-h-0 flex-1 sm:mx-8">
            <RemoteImage src={src} alt={alt} fill sizes="100vw" className="h-full w-full object-contain" />
          </div>
        </div>
      ) : null}
    </>
  );
}
