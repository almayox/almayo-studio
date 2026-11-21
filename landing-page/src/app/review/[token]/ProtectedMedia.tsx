"use client";

import type { ReviewMedia } from "./types";

/**
 * An image or video of a post. Until the files are released it cannot be
 * dragged out, saved from the menu or downloaded from the player.
 */
export function ProtectedMedia({
  media,
  alt,
  released,
  controls = false,
  contain = false,
  className = "",
}: {
  media: ReviewMedia;
  alt: string;
  released: boolean;
  /** Show the video player; tiles in the grid only show the first frame. */
  controls?: boolean;
  /** Show the whole picture instead of cropping it to fill the frame. */
  contain?: boolean;
  className?: string;
}) {
  const fit = contain ? "object-contain" : "object-cover";
  // "#t=0.1" makes the browser show a frame instead of an empty box before playing.
  const videoSrc = media.url.includes("#") ? media.url : `${media.url}#t=0.1`;
  return (
    <div
      className={`relative overflow-hidden bg-foam ${className}`}
      onContextMenu={released ? undefined : (event) => event.preventDefault()}
    >
      {media.video ? (
        <video
          src={videoSrc}
          controls={controls}
          playsInline
          muted={!controls}
          preload="metadata"
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          className={`h-full w-full ${fit}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt={alt}
          draggable={false}
          className={`h-full w-full select-none ${fit}`}
        />
      )}
    </div>
  );
}
