"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import type { AboutContent, LogoVariant, SiteSettings } from "@/lib/types";

const NAVBAR_LOGOS = [
  {
    variant: "navbar_on_dark",
    title: "Navbar logo · on dark",
    hint: "Use a light / white logo for navy hero & footer.",
    previewDark: true,
  },
  {
    variant: "navbar_on_light",
    title: "Navbar logo · on light",
    hint: "Use a dark / navy logo for white pages.",
    previewDark: false,
  },
] as const;

export function BrandAssetsManager({
  settings,
  about,
  logos,
  compact = false,
  embedded = false,
}: {
  settings: SiteSettings;
  about: AboutContent;
  logos: LogoVariant[];
  compact?: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);

  function logoUrl(variant: string) {
    const match = logos.find((l) => l.variant_type === variant);
    if (match?.url) return match.url;
    if (variant === "navbar_on_light") {
      return logos.find((l) => l.variant_type === "horizontal")?.url ?? null;
    }
    return null;
  }

  async function saveSetting(field: "og_image_url", file: File) {
    setBusy(field);
    setUploadPhase("uploading");
    setError(null);
    setMessage(null);
    try {
      const url = await uploadStudioFile(file, {
        folder: "brand",
        onPhase: setUploadPhase,
      });
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ [field]: url })
        .eq("id", settings.id);
      if (updateError) throw updateError;
      setMessage("Brand asset saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      setUploadPhase(null);
    }
  }

  async function saveLogo(variant: string, file: File) {
    setBusy(variant);
    setUploadPhase("uploading");
    setError(null);
    setMessage(null);
    try {
      const url = await uploadStudioFile(file, {
        folder: "logos",
        onPhase: setUploadPhase,
      });
      const supabase = createClient();
      const { error: upsertError } = await supabase.from("logo_variants").upsert(
        { variant_type: variant, url },
        { onConflict: "variant_type" },
      );
      if (upsertError) throw upsertError;
      setMessage("Logo saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      setUploadPhase(null);
    }
  }

  return (
    <section className={embedded ? "space-y-4" : "space-y-4 rounded-xl border border-mist bg-white p-5"}>
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
          Brand assets
        </h2>
        <p className="mt-1 text-sm text-navy/55">
          Navbar logos and social share image.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {NAVBAR_LOGOS.map((slot) => (
          <AssetSlot
            key={slot.variant}
            title={slot.title}
            hint={slot.hint}
            preview={logoUrl(slot.variant)}
            previewDark={slot.previewDark}
            busy={busy === slot.variant}
            status={busy === slot.variant ? uploadStatusLabel(uploadPhase) : null}
            compact={compact}
            onFiles={(files) => {
              const file = files[0];
              if (file) void saveLogo(slot.variant, file);
            }}
          />
        ))}
        <AssetSlot
          title="OG / share image"
          preview={settings.og_image_url}
          busy={busy === "og_image_url"}
          status={busy === "og_image_url" ? uploadStatusLabel(uploadPhase) : null}
          compact={compact}
          onFiles={(files) => {
            const file = files[0];
            if (file) void saveSetting("og_image_url", file);
          }}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <p className="text-[11px] text-navy/40">
        Logo table missing? Run <code className="rounded bg-foam px-1">schema_parity.sql</code>.
      </p>
    </section>
  );
}

function AssetSlot({
  title,
  hint,
  preview,
  previewDark,
  busy,
  status,
  compact,
  onFiles,
}: {
  title: string;
  hint?: string;
  preview: string | null | undefined;
  previewDark?: boolean;
  busy: boolean;
  status?: string | null;
  compact?: boolean;
  onFiles: (files: FileList) => void;
}) {
  const previewHeight = compact ? "h-14" : "h-12";
  const dropClass = compact
    ? "mt-2 flex flex-col items-center rounded-lg border border-dashed border-mist bg-white px-3 py-2 text-center text-xs text-navy/70"
    : "mt-3 flex flex-col items-center rounded-lg border border-dashed border-mist bg-white px-3 py-4 text-center text-xs text-navy/70";

  return (
    <div className="rounded-lg border border-mist bg-foam/40 p-3">
      <p className="text-sm font-medium text-navy">{title}</p>
      {hint ? <p className="mt-0.5 text-xs text-navy/50">{hint}</p> : null}
      <div
        className={`mt-2 flex min-h-14 items-center justify-center rounded-lg px-3 py-2 ${
          previewDark ? "bg-navy" : "bg-white ring-1 ring-mist"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={title}
            className={`${previewHeight} w-auto max-w-full object-contain`}
          />
        ) : (
          <p className={`text-xs ${previewDark ? "text-white/50" : "text-navy/40"}`}>
            Not set
          </p>
        )}
      </div>
      <DropUpload
        onFiles={onFiles}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        disabled={busy}
        className={dropClass}
      >
        {busy ? status || "Uploading…" : "Drop or click to upload"}
      </DropUpload>
    </div>
  );
}
