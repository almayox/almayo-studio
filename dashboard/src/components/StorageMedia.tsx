"use client";

import { useEffect, useState, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { parseSupabaseStorageUrl, resolveStorageUrl } from "@/lib/storage";

export function useStorageUrl(url: string | null | undefined) {
  const [resolved, setResolved] = useState<string | null>(url ?? null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    if (!parseSupabaseStorageUrl(url)) {
      setResolved(url);
      return;
    }
    resolveStorageUrl(url).then((next) => {
      if (active) setResolved(next);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
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
  return <video src={resolved} {...props} />;
}
