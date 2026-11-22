"use client";

import { useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/RemoteImage";

/**
 * A project image shown whole, in its own shape: a wide banner stays wide and a
 * tall poster stays tall. The shape is read from the image once it loads.
 */
export function ProjectImage({ src, alt }: { src: string; alt: string }) {
  // Until the image reports its size, hold a 4:3 place for it.
  const [ratio, setRatio] = useState(4 / 3);
  const frame = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={frame}
      className="relative overflow-hidden rounded-2xl bg-navy/5"
      style={{ aspectRatio: ratio, width: `min(100%, calc(var(--media-row) * ${ratio}))` }}
    >
      <RemoteImage
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1152px) 1104px, 100vw"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
