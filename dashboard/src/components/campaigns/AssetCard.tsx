"use client";

import { Pencil, Trash2 } from "lucide-react";
import { StorageImage, StorageVideo } from "@/components/StorageMedia";
import { ActionButton } from "@/components/ui/ActionButton";
import { ASSET_APPROVAL_STATUSES, type AssetRow } from "@/lib/campaigns";
import { bySortOrder } from "@/lib/lineItems";

/** One asset of a campaign: details, approval state, comments, media and slides. */
export function AssetCard({
  asset,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onApprovalChange,
  onRemoveSlide,
}: {
  asset: AssetRow;
  /** The selected asset is the one new carousel slides are added to. */
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApprovalChange: (status: string) => void;
  onRemoveSlide: (slideId: string) => void;
}) {
  const slides = bySortOrder(asset.campaign_asset_slides);
  const comments = (asset.campaign_comments || [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div
      className={`rounded-xl border p-3 ${
        selected ? "border-fg/40 bg-subtle/60" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="text-left">
          <p className="font-medium text-fg">{asset.title}</p>
          <p className="text-xs text-fg/50">
            {asset.type}
            {asset.publish_date ? ` · ${asset.publish_date}` : ""}
            {" · "}
            {slides.length} slide
            {slides.length === 1 ? "" : "s"} · {asset.approval_status}
            {comments.length ? ` · ${comments.length} comment(s)` : ""}
          </p>
          {asset.caption ? (
            <p className="mt-1 line-clamp-2 text-xs text-fg/65">{asset.caption}</p>
          ) : null}
          {asset.hashtags ? (
            <p className="mt-1 line-clamp-1 text-xs text-fg/55">{asset.hashtags}</p>
          ) : null}
          {asset.notes ? (
            <p className="mt-1 line-clamp-2 text-xs italic text-fg/45">{asset.notes}</p>
          ) : null}
        </button>
        <ActionButton icon={Pencil} label="Edit asset" onClick={onEdit} />
        <ActionButton icon={Trash2} label="Delete" danger onClick={onDelete} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {ASSET_APPROVAL_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onApprovalChange(status)}
            className={`inline-flex h-[var(--control-h)] items-center rounded-xl px-3 text-[11px] ${
              asset.approval_status === status
                ? "bg-fg text-canvas"
                : "bg-subtle text-fg/70 ring-1 ring-line"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {comments.length ? (
        <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-fg/70">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-subtle/80 px-2 py-1">
              <span className="font-medium text-fg">{comment.author_name}:</span>{" "}
              {comment.body || "-"}
            </li>
          ))}
        </ul>
      ) : null}

      {asset.media_url ? (
        asset.type === "video" || asset.type === "reel" ? (
          <StorageVideo
            src={asset.media_url}
            className="mt-3 aspect-video w-full rounded-xl object-cover"
          />
        ) : (
          <StorageImage
            src={asset.media_url}
            alt={asset.title}
            className="mt-3 aspect-video w-full rounded-xl object-cover"
          />
        )
      ) : null}

      {slides.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {slides.map((slide) => (
            <div key={slide.id} className="relative overflow-hidden rounded-xl">
              <StorageImage
                src={slide.media_url}
                alt={slide.caption || "Slide"}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                aria-label="Remove slide"
                onClick={() => onRemoveSlide(slide.id)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
