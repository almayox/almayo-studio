import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /** Fill the (relatively positioned) parent and serve responsive sizes. */
  fill?: boolean;
  sizes?: string;
  /** Above-the-fold image: load immediately instead of lazily. */
  priority?: boolean;
};

const STABLE_STORAGE_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i;

/**
 * Portfolio media has a stable public URL, so it goes through the image
 * optimiser: visitors get an AVIF/WebP file sized for their screen, cached at
 * the edge. Anything else (signed or third-party URLs) is a plain image.
 */
export function RemoteImage({ src, alt, className, style, fill, sizes, priority }: Props) {
  if (fill && STABLE_STORAGE_RE.test(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        quality={85}
        priority={priority}
        className={className}
        style={style}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
