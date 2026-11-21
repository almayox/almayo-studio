"use client";

import { useState } from "react";

/**
 * A project video shown in its own shape: a vertical reel stays tall and a
 * horizontal film stays wide. The shape is read from the video once it loads.
 */
export function ProjectVideo({ src, poster }: { src: string; poster?: string | null }) {
  // Until the video reports its size, hold a 16:9 place for it.
  const [ratio, setRatio] = useState(16 / 9);

  function measure(video: HTMLVideoElement | null) {
    if (!video?.videoWidth || !video.videoHeight) return;
    const next = video.videoWidth / video.videoHeight;
    setRatio((current) => (Math.abs(current - next) < 0.001 ? current : next));
  }

  return (
    <div
      className="overflow-hidden rounded-2xl bg-navy/5"
      style={{ aspectRatio: ratio, width: `min(100%, calc(var(--media-row) * ${ratio}))` }}
    >
      <video
        // The video may already be loaded by the time the page becomes interactive.
        ref={measure}
        onLoadedMetadata={(event) => measure(event.currentTarget)}
        // Without a thumbnail of its own, "#t=0.1" shows the first frame instead of black.
        src={poster ? src : `${src}#t=0.1`}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
