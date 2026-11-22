"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useStorageUrl } from "@/components/StorageMedia";
import { Modal } from "@/components/ui/Modal";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";

/** The shape of a post in the social media grid and, nearly, of a project card. */
const CROP_RATIO = 3 / 4;

function parsePosition(value: string | null | undefined) {
  const match = /^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(value || "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 50, y: 50 };
}

/**
 * Chooses which part of a picture stays visible when it is cropped to the
 * grid's shape: drag the bright frame over the picture, the dimmed part is
 * what gets cut off. Gives back a position like "30% 50%". Mount it to open it.
 */
export function CropPositionDialog({
  imageUrl,
  position,
  onClose,
  onSave,
}: {
  imageUrl: string;
  /** The current position, e.g. "50% 50%". */
  position?: string | null;
  onClose: () => void;
  onSave: (position: string) => void;
}) {
  const resolved = useStorageUrl(imageUrl);
  const [focus, setFocus] = useState(() => parsePosition(position));
  /** The picture's own shape, known once it has loaded. */
  const [ratio, setRatio] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

  function measure(image: HTMLImageElement | null) {
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
    const next = image.naturalWidth / image.naturalHeight;
    setRatio((current) => (current === next ? current : next));
  }

  // Wider than the frame: the frame is full height and slides sideways.
  // Taller: it is full width and slides up and down.
  const wide = ratio !== null && ratio > CROP_RATIO;
  const frame =
    ratio === null
      ? { width: 100, height: 100 }
      : wide
        ? { width: (CROP_RATIO / ratio) * 100, height: 100 }
        : { width: 100, height: (ratio / CROP_RATIO) * 100 };
  const slack = { x: 100 - frame.width, y: 100 - frame.height };

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!start || !box) return;
    const clamp = (value: number) => Math.min(100, Math.max(0, value));
    // How far the frame moved, as a share of the room it has to move in.
    const dx = slack.x ? (((event.clientX - start.x) / box.width) * 100 * 100) / slack.x : 0;
    const dy = slack.y ? (((event.clientY - start.y) / box.height) * 100 * 100) / slack.y : 0;
    setFocus({ x: clamp(start.from.x + dx), y: clamp(start.from.y + dy) });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Choose the crop"
      description="Drag the bright frame to the part that should show in the grid. The dimmed part is cut off."
      wide
    >
      <div className="space-y-4">
        <div className="flex justify-center rounded-lg bg-black/40 p-3">
          {resolved ? (
            <div className="relative inline-block max-w-full select-none overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolved}
                alt=""
                draggable={false}
                // A picture the browser already has can finish before onLoad is listening.
                ref={measure}
                onLoad={(event) => measure(event.currentTarget)}
                className="block max-h-[60vh] max-w-full"
              />
              {ratio === null ? null : (
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Crop position"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(wide ? focus.x : focus.y)}
                  onPointerDown={(event) => {
                    // Keeps the drag going when the pointer leaves the frame.
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // Not every pointer can be captured; dragging inside the frame still works.
                    }
                    drag.current = { x: event.clientX, y: event.clientY, from: focus };
                  }}
                  onPointerMove={onMove}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(event) => {
                    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[
                      event.key
                    ];
                    if (!step) return;
                    event.preventDefault();
                    setFocus((current) => ({
                      x: Math.min(100, Math.max(0, current.x + step[0])),
                      y: Math.min(100, Math.max(0, current.y + step[1])),
                    }));
                  }}
                  // The huge shadow is the dimming over everything outside the frame.
                  className="absolute cursor-grab touch-none rounded-sm border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] active:cursor-grabbing"
                  style={{
                    width: `${frame.width}%`,
                    height: `${frame.height}%`,
                    left: `${(slack.x * focus.x) / 100}%`,
                    top: `${(slack.y * focus.y) / 100}%`,
                  }}
                >
                  <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                    Drag
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="p-6 text-sm text-white/70">Loading image…</p>
          )}
        </div>
        {ratio !== null && !slack.x && !slack.y ? (
          <p className="text-xs text-fg/55">This picture already has the shape of the grid, so nothing is cut off.</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(`${Math.round(focus.x)}% ${Math.round(focus.y)}%`)}
            className={primaryBtnClass}
          >
            Set crop
          </button>
        </div>
      </div>
    </Modal>
  );
}
