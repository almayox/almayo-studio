"use client";

type Props = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  priority?: boolean;
};

/** Portfolio images may come from Supabase or arbitrary CDNs. Use plain img to avoid host whitelist errors. */
export function RemoteImage({ src, alt, className, style }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} style={style} loading="lazy" />
  );
}
