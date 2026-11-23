"use client";

import { useEffect, useRef, useState } from "react";
import { DropUpload } from "@/components/DropUpload";
import { useStorageUrl } from "@/components/StorageMedia";
import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import { repairGlb } from "@/lib/glb";
import { uploadStudioFile } from "@/lib/upload";

/** The part of the 3D viewer element this dialog uses. */
type ViewerElement = HTMLElement & {
  toBlob(options?: { mimeType?: string; idealAspect?: boolean }): Promise<Blob>;
  updateComplete?: Promise<unknown>;
};

// The saved picture: the 3:4 shape of a project card, sharp on high-density screens.
const SHOT_WIDTH = 1200;
const SHOT_HEIGHT = 1600;

function frames(count: number) {
  return new Promise<void>((resolve) => {
    const step = () => (--count <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
}

/**
 * A picture of the view on screen at the saved size. The viewer draws at the
 * size it is shown, so it is enlarged for a moment while the picture is taken.
 */
async function takeShot(model: ViewerElement): Promise<Blob> {
  const { width, height } = model.style;
  model.style.width = `${SHOT_WIDTH / window.devicePixelRatio}px`;
  model.style.height = `${SHOT_HEIGHT / window.devicePixelRatio}px`;
  try {
    await model.updateComplete;
    await frames(3);
    return await model.toBlob();
  } finally {
    model.style.width = width;
    model.style.height = height;
  }
}

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
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
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
    let repairedUrl: string | null = null;
    // Models uploaded before the upload repaired them may hold an empty
    // texture, which the viewer refuses; open a repaired copy of those.
    const source = fetch(resolved)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        const repaired = repairGlb(buffer);
        if (!repaired) return resolved;
        repairedUrl = URL.createObjectURL(new Blob([repaired], { type: "model/gltf-binary" }));
        return repairedUrl;
      })
      .catch(() => resolved);
    // The viewer is a web component that only works in the browser, so it is
    // loaded here rather than at the top of the file.
    void Promise.all([source, import("@google/model-viewer")]).then(([src]) => {
      if (stopped) return;
      // By default the viewer lowers its drawing size to stay smooth, which
      // made saved pictures blurry. Always draw at full size here.
      const viewerClass = customElements.get("model-viewer") as
        | { minimumRenderScale?: number }
        | undefined;
      if (viewerClass) viewerClass.minimumRenderScale = 1;
      const model = document.createElement("model-viewer") as ViewerElement;
      model.setAttribute("src", src);
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
      if (repairedUrl) URL.revokeObjectURL(repairedUrl);
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
      description="The picture shown for this model in lists. The frame has the shape of a project card. Drag the model to the angle you want, scroll to zoom, and use that view, or add your own image."
      wide
    >
      <div className="space-y-4">
        {/* The shape of a project card, so what is framed here is what the card shows. */}
        <div
          ref={holder}
          className="mx-auto aspect-[3/4] h-[55vh] max-w-full overflow-hidden rounded-lg bg-[#f3f6fb]"
        >
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
              void save(async () => onBackground(await takeShot(model)), false);
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
