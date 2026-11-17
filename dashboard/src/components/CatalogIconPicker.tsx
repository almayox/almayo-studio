"use client";

import { useRef, useState } from "react";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import {
  CATALOG_ICON_OPTIONS,
  isCatalogIconUrl,
  resolveCatalogIcon,
} from "@/lib/catalogIcons";
import { StorageImage } from "@/components/StorageMedia";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function CatalogIconPicker({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SelectedIcon = resolveCatalogIcon(isCatalogIconUrl(value) ? null : value);
  const hasCustomImage = isCatalogIconUrl(value);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadPhase("compressing");
    setError(null);
    try {
      const url = await uploadStudioFile(file, {
        folder: "catalog-icons",
        maxEdge: 256,
        imageQuality: 0.9,
        onPhase: setUploadPhase,
      });
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fg/5 text-fg">
          {hasCustomImage ? (
            <StorageImage src={value} alt="" className="h-7 w-7 object-contain" />
          ) : (
            // Looked up from a fixed icon map, not created here.
            // eslint-disable-next-line react-hooks/static-components
            <SelectedIcon className="h-6 w-6" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">Category icon</p>
          <p className="text-xs text-fg/50">
            Pick a preset icon or upload a custom image (PNG, SVG, WebP).
          </p>
        </div>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 text-xs font-medium text-fg/55 hover:text-fg"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {CATALOG_ICON_OPTIONS.map(({ name, Icon }) => {
          const active = !hasCustomImage && value === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                active
                  ? "border-fg bg-fg text-canvas"
                  : "border-line bg-surface text-fg/70 hover:border-fg/25 hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-fg/75 hover:border-fg/20 hover:text-fg disabled:opacity-60"
        >
          {uploading ? uploadStatusLabel(uploadPhase) : "Upload custom icon"}
        </button>
        {hasCustomImage ? (
          <span className="text-xs text-fg/45">Using uploaded image</span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
