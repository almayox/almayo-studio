"use client";

import { useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/RemoteImage";

/**
 * An image that fills a tile and is cropped to it. `sizes` says how wide the
 * tile is, but a picture that is wider in shape than its tile is shown larger
 * than the tile and cropped at the sides, so it needs more pixels than that.
 * Once the picture's shape is known, a sharper copy is asked for.
 */
export function CoverImage({
  src,
  alt,
  tileRatio,
  sizes,
  priority,
  className,
  style,
}: {
  src: string;
  alt: string;
  /** Width divided by height of the tile, for example 3 / 4. */
  tileRatio: number;
  /** How wide the tile is on screen. */
  sizes: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const holder = useRef<HTMLSpanElement>(null);
  const [factor, setFactor] = useState(1);

  useEffect(() => {
    const image = holder.current?.querySelector("img");
    if (!image) return;
    const measure = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const wider = image.naturalWidth / image.naturalHeight / tileRatio;
      // Rounded up to a quarter, so it settles after one step.
      const next = wider > 1.05 ? Math.ceil(wider * 4) / 4 : 1;
      setFactor((current) => (current === next ? current : next));
    };
    measure();
    image.addEventListener("load", measure);
    return () => image.removeEventListener("load", measure);
  }, [src, tileRatio]);

  // Widths in the list are enlarged; the screen widths in brackets are left alone.
  const scaled =
    factor === 1
      ? sizes
      : sizes.replace(/(\d+(?:\.\d+)?)(px|vw)(?!\s*\))/g, (_, value: string, unit: string) => {
          return `${Math.round(Number(value) * factor)}${unit}`;
        });

  return (
    <span ref={holder} className="contents">
      <RemoteImage
        src={src}
        alt={alt}
        fill
        sizes={scaled}
        priority={priority}
        className={className}
        style={style}
      />
    </span>
  );
}
