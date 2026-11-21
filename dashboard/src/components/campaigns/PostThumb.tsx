"use client";

import { StorageImage, StorageVideo } from "@/components/StorageMedia";
import { isVideoType, isVideoUrl, type AssetRow } from "@/lib/campaigns";

/** A 4:5 tile showing a post's first image or video frame, as on a profile grid. */
export function PostThumb({ asset }: { asset: AssetRow | undefined }) {
  const src = asset?.media_url;
  if (!asset || !src) return <div className="aspect-[4/5] bg-subtle" />;
  return isVideoType(asset.type) || isVideoUrl(src) ? (
    <StorageVideo src={src} muted preload="metadata" className="aspect-[4/5] w-full object-cover" />
  ) : (
    <StorageImage src={src} alt="" className="aspect-[4/5] w-full object-cover" />
  );
}
