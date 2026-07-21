"use client";

import { useRef } from "react";

export function ThumbnailPositionPicker({
  url,
  position,
  onChange,
}: {
  url: string;
  position: string;
  onChange: (pos: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getPct = (e: React.PointerEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(
      Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
    );
    const y = Math.round(
      Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    );
    return `${x}% ${y}%`;
  };

  const parts = position.split(" ");
  const cx = parseFloat(parts[0]) || 50;
  const cy = parseFloat(parts[1]) || 50;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-navy/55">Drag to reposition thumbnail</p>
        <button
          type="button"
          onClick={() => onChange("50% 50%")}
          className="text-[11px] text-navy/50 underline hover:text-navy"
        >
          Reset center
        </button>
      </div>
      <div
        ref={containerRef}
        className="relative h-40 cursor-crosshair select-none overflow-hidden rounded-xl border border-mist"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = getPct(e);
          if (p) onChange(p);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) return;
          const p = getPct(e);
          if (p) onChange(p);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{ objectPosition: position }}
        />
        <div
          className="pointer-events-none absolute"
          style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="relative h-8 w-8">
            <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-px bg-white/90 shadow" />
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-px bg-white/90 shadow" />
            <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20" />
          </div>
        </div>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/85">
          drag to reposition
        </span>
      </div>
    </div>
  );
}
