"use client";

import { useEffect, useRef, useState } from "react";
import { DropUpload } from "@/components/DropUpload";
import { useStorageUrl } from "@/components/StorageMedia";
import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import { uploadStudioFile } from "@/lib/upload";

/** The part of the 3D viewer element this dialog uses. */
type ViewerElement = HTMLElement & {
  toBlob(options?: { mimeType?: string; idealAspect?: boolean }): Promise<Blob>;
};

/** Puts the picture of the model on the site's light background, as a JPEG. */
async function onBackground(picture: Blob): Promise<File> {
  const bitmap = await createImageBitmap(picture);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not save the picture.");
  ctx.fillStyle = "#f3f6fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("This browser could not save the picture.");
  return new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
}

/**
 * Lets the owner turn a 3D model to the angle they like and save that view as
 * its thumbnail, or use an image of their own. Mount it to open it.
 */
export function ModelThumbnailPicker({
  modelUrl,
  onClose,
  onPicked,
}: {
  modelUrl: string;
  onClose: () => void;
  /** Called with the stored URL of the new thumbnail image. */
  onPicked: (url: string) => void;
}) {
  const resolved = useStorageUrl(modelUrl);
  const holder = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = holder.current;
    if (!resolved || !element) return;
    let stopped = false;
    // The viewer is a web component that only works in the browser, so it is
    // loaded here rather than at the top of the file.
    void import("@google/model-viewer").then(() => {
      if (stopped) return;
      const model = document.createElement("model-viewer") as ViewerElement;
      model.setAttribute("src", resolved);
      model.setAttribute("camera-controls", "");
      model.setAttribute("interaction-prompt", "none");
      model.setAttribute("shadow-intensity", "0.6");
      model.style.width = "100%";
      model.style.height = "100%";
      model.style.backgroundColor = "#f3f6fb";
      model.addEventListener("error", () =>
        setError("This model could not be opened. Export it from Blender as GLB without compression."),
      );
      element.appendChild(model);
      viewer.current = model;
    });
    return () => {
      stopped = true;
      viewer.current?.remove();
      viewer.current = null;
    };
  }, [resolved]);

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
      setError(caught instanceof Error ? caught.message : "Saving the thumbnail failed.");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="3D model thumbnail"
      description="The picture shown for this model in lists. Drag the model to the angle you want and use that view, or add your own image."
      wide
    >
      <div className="space-y-4">
        <div ref={holder} className="h-[50vh] overflow-hidden rounded-lg bg-[#f3f6fb]">
          {resolved ? null : <p className="p-4 text-sm text-black/50">Loading model…</p>}
        </div>
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
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const model = viewer.current;
              if (!model) return;
              void save(async () => onBackground(await model.toBlob({ idealAspect: true })), false);
            }}
            disabled={saving || !resolved}
            className={primaryBtnClass}
          >
            {saving ? "Saving…" : "Use this view"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
