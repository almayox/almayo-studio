"use client";

import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ImgHTMLAttributes,
  type VideoHTMLAttributes,
} from "react";
import { parseSupabaseStorageUrl, resolveStorageUrl } from "@/lib/storage";

/**
 * Files live in private storage. Stored URLs are turned into short-lived signed
 * URLs for display; anything else (blob previews, external links) is used as is.
 */
export function useStorageUrl(url: string | null | undefined) {
  const needsSigning = Boolean(url && parseSupabaseStorageUrl(url));
  const [signed, setSigned] = useState<{ source: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!url || !needsSigning) return;
    let active = true;
    resolveStorageUrl(url).then((next) => {
      if (active) setSigned({ source: url, url: next });
    });
    return () => {
      active = false;
    };
  }, [url, needsSigning]);

  if (!url) return null;
  if (!needsSigning) return url;
  return signed?.source === url ? signed.url : null;
}

type MediaProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string | null | undefined;
};

export function StorageImage({ src, alt = "", ...props }: MediaProps) {
  const resolved = useStorageUrl(src);
  if (!resolved) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} {...props} />;
}

type VideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  src: string | null | undefined;
};

export function StorageVideo({ src, ...props }: VideoProps) {
  const resolved = useStorageUrl(src);
  if (!resolved) return null;
  // "#t=0.1" makes the browser show a frame instead of a black box before playing.
  return <video src={resolved.includes("#") ? resolved : `${resolved}#t=0.1`} {...props} />;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string | null | undefined;
};

/** Link to a stored file (receipt, resume): opens a freshly signed URL. */
export function StorageLink({ href, children, ...props }: LinkProps) {
  const resolved = useStorageUrl(href);
  if (!resolved) return <span className={props.className}>{children}</span>;
  return (
    <a href={resolved} {...props}>
      {children}
    </a>
  );
}
