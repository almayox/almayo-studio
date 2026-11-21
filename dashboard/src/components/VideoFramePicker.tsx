"use client";

import { useRef, useState } from "react";
import { DropUpload } from "@/components/DropUpload";
import { useStorageUrl } from "@/components/StorageMedia";
import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import { uploadStudioFile } from "@/lib/upload";

const MAX_EDGE = 1920;

/** Draws the frame the video is showing right now into a JPEG file. */
async function captureFrame(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("The video has not loaded yet. Wait a moment and try again.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not read the frame.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("This browser could not read the frame.");
  return new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
}

/**
 * Lets the owner choose a thumbnail for a project video: the frame on screen,
 * or an image of their own. Mount it to open it.
 */
export function VideoFramePicker({
  videoUrl,
  onClose,
  onPicked,
}: {
  videoUrl: string;
  onClose: () => void;
  /** Called with the stored URL of the new thumbnail image. */
  onPicked: (url: string) => void;
}) {
  const resolved = useStorageUrl(videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Uploads the chosen image (a captured frame or the owner's own file). */
  async function save(getFile: () => Promise<File>, optimizeImage: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const url = await uploadStudioFile(await getFile(), {
        bucket: "project-media",
        folder: "projects",
        optimizeImage,
      });
      onPicked(url);
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "SecurityError"
          ? "The browser blocked reading this video. Upload an image instead."
          : caught instanceof Error
            ? caught.message
            : "Saving the thumbnail failed.",
      );
      setSaving(false);
    }
  }

  function useFrame() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    void save(() => captureFrame(video), false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Video thumbnail"
      description="The image shown on this video before it plays. Drag the bar to the moment you want and use that frame, or add your own image."
      wide
    >
      <div className="space-y-4">
        {resolved ? (
          <video
            ref={videoRef}
            // Needed so the frame can be read back from the video.
            crossOrigin="anonymous"
            src={`${resolved}#t=0.1`}
            controls
            muted
            playsInline
            preload="auto"
            className="mx-auto max-h-[50vh] w-auto max-w-full rounded-lg bg-black"
          />
        ) : (
          <p className="text-sm text-fg/50">Loading video…</p>
        )}
        <DropUpload
          onFiles={(files) => {
            const file = files[0];
            if (!file.type.startsWith("image/")) return setError("Choose an image file.");
            void save(async () => file, true);
          }}
          accept="image/*"
          disabled={saving}
          className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line bg-subtle px-4 py-4 text-center transition hover:border-fg/30"
        >
          <span className="text-sm font-medium text-fg">
            Or drop your own image here, or click to upload
          </span>
          <span className="text-xs text-fg/50">PNG, JPG or WEBP</span>
        </DropUpload>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={useFrame}
            disabled={saving || !resolved}
            className={primaryBtnClass}
          >
            {saving ? "Saving…" : "Use this frame"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
