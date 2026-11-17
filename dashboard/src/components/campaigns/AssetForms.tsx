"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { ASSET_TYPE_OPTIONS, type AssetRow, type AssetType } from "@/lib/campaigns";
import { createClient } from "@/lib/supabase/client";
import type { CampaignUpload, ReportError } from "@/components/campaigns/hooks";

const notesAreaClass = `${fieldClass} !h-auto max-h-none py-2.5`;

function AssetTypeSelect({
  value,
  onChange,
}: {
  value: AssetType;
  onChange: (type: AssetType) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AssetType)}
      className={fieldClass}
    >
      {ASSET_TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Stored type of a new asset: the chosen one, corrected by what was dropped. */
function typeForUpload(chosen: AssetType, file: File) {
  if (chosen === "reel") return "reel";
  if (chosen === "video" || file.type.startsWith("video/")) return "video";
  return chosen === "carousel" ? "carousel" : "single";
}

/** Details of a new asset plus the drop zone that creates it. */
export function AddAssetForm({
  campaignId,
  nextSortOrder,
  upload,
  onError,
  onCarouselCreated,
}: {
  campaignId: string;
  nextSortOrder: number;
  upload: CampaignUpload;
  onError: ReportError;
  /** A new carousel is selected straight away, ready for more slides. */
  onCarouselCreated: (assetId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<AssetType>("single");

  function createAsset(files: FileList) {
    if (!title.trim()) {
      onError("Select a campaign and enter an asset title first.");
      return;
    }
    const file = files[0];
    if (!file) return;

    upload.run(file, "Upload failed", async (url, supabase) => {
      const storedType = typeForUpload(type, file);
      const { data: asset, error: insertError } = await supabase
        .from("campaign_assets")
        .insert({
          campaign_id: campaignId,
          title: title.trim(),
          caption: caption || null,
          hashtags: hashtags.trim() || null,
          publish_date: publishDate || null,
          notes: notes.trim() || null,
          media_url: url,
          thumbnail_url: url,
          type: storedType,
          sort_order: nextSortOrder,
          approval_status: "pending",
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      let warning: string | undefined;
      if (storedType === "carousel" && asset) {
        const { error: slideError } = await supabase.from("campaign_asset_slides").insert({
          asset_id: asset.id,
          media_url: url,
          caption: caption || null,
          sort_order: 0,
        });
        if (slideError) {
          warning = `Asset created, but its first slide was not saved: ${slideError.message}`;
        }
        onCarouselCreated(asset.id);
      }

      setTitle("");
      setCaption("");
      setHashtags("");
      setPublishDate("");
      setNotes("");
      return warning;
    });
  }

  return (
    <div className="rounded-xl border border-line bg-subtle/40 p-4">
      <p className="text-sm font-medium text-fg">Add asset</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={`${labelClass} sm:col-span-1`}>
          Asset title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Caption
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Type
          <AssetTypeSelect value={type} onChange={setType} />
        </label>
        <label className={labelClass}>
          Publish date
          <input
            type="date"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Hashtags
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#brand #campaign"
            className={fieldClass}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
          Internal notes
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${notesAreaClass} min-h-[5rem]`}
          />
        </label>
      </div>

      <DropUpload
        onFiles={createAsset}
        accept="image/*,video/*"
        disabled={upload.uploading}
        className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-fg/70"
      >
        {upload.uploading ? upload.label : "Drop media to create asset"}
      </DropUpload>
    </div>
  );
}

/** Edits the details of an existing asset. Mount it to open it. */
export function AssetEditModal({ asset, onClose }: { asset: AssetRow; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: asset.title,
    caption: asset.caption || "",
    hashtags: asset.hashtags || "",
    publishDate: asset.publish_date || "",
    notes: asset.notes || "",
    type: (asset.type as AssetType) || "single",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient()
      .from("campaign_assets")
      .update({
        title: form.title.trim(),
        caption: form.caption.trim() || null,
        hashtags: form.hashtags.trim() || null,
        publish_date: form.publishDate || null,
        notes: form.notes.trim() || null,
        type: form.type,
      })
      .eq("id", asset.id);
    setSaving(false);
    if (updateError) return setError(updateError.message);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit asset"
      description="Update post details, schedule, and internal notes."
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className={labelClass}>
          Title
          <input
            required
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Type
          <AssetTypeSelect value={form.type} onChange={(type) => set({ type })} />
        </label>
        <label className={labelClass}>
          Publish date
          <input
            type="date"
            value={form.publishDate}
            onChange={(e) => set({ publishDate: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Caption
          <textarea
            rows={3}
            value={form.caption}
            onChange={(e) => set({ caption: e.target.value })}
            className={`${notesAreaClass} min-h-[5rem]`}
          />
        </label>
        <label className={labelClass}>
          Hashtags
          <input
            value={form.hashtags}
            onChange={(e) => set({ hashtags: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Internal notes
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className={`${notesAreaClass} min-h-[4.5rem]`}
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
            {saving ? "Saving…" : "Save asset"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
