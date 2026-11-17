"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { StorageImage } from "@/components/StorageMedia";
import { AssetCard } from "@/components/campaigns/AssetCard";
import { AddAssetForm, AssetEditModal } from "@/components/campaigns/AssetForms";
import { ReviewAccessCard } from "@/components/campaigns/ReviewAccessCard";
import {
  useCampaignUpload,
  useCampaignWrite,
  type ReportError,
} from "@/components/campaigns/hooks";
import {
  controlRowClass,
  primaryBtnClass,
  secondaryBtnClass,
  softLinkClass,
} from "@/components/ui/PageChrome";
import { deleteAsset, type AssetRow, type CampaignRow } from "@/lib/campaigns";
import { bySortOrder } from "@/lib/lineItems";
import { createClient } from "@/lib/supabase/client";

const CLEARED_DECISION = {
  client_decision: null,
  client_approved_by_name: null,
  client_approved_at: null,
};

function Detail({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-fg/50">{label}</dt>
      {children}
    </div>
  );
}

/**
 * Everything about one campaign: details, cover, client decision, review
 * access, assets and feedback. Give it `key={campaign.id}` so its own state
 * starts fresh for each campaign.
 */
export function CampaignPanel({
  campaign,
  copied,
  onCopyLink,
  onEdit,
  onClose,
  onError,
}: {
  campaign: CampaignRow;
  /** True right after this campaign's review link was copied. */
  copied: boolean;
  onCopyLink: (reviewToken: string) => void;
  onEdit: () => void;
  onClose: () => void;
  onError: ReportError;
}) {
  const router = useRouter();
  const write = useCampaignWrite(onError);
  const upload = useCampaignUpload(campaign.id, onError);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const assets = campaign.campaign_assets ?? [];
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || null;
  const countWith = (status: string) =>
    assets.filter((asset) => asset.approval_status === status).length;
  const changesCount = countWith("changes_requested");
  const feedbackCount = assets.reduce((n, a) => n + (a.campaign_comments?.length ?? 0), 0);

  const updateCampaign = (values: Record<string, unknown>) =>
    write((supabase) => supabase.from("campaigns").update(values).eq("id", campaign.id));

  async function resetForRevision() {
    if (
      !window.confirm(
        "Reset this campaign for revision? Client sign-off will clear and all assets go back to pending.",
      )
    ) {
      return;
    }
    onError(null);
    const supabase = createClient();
    const { error: campaignError } = await supabase
      .from("campaigns")
      .update({ ...CLEARED_DECISION, status: "review" })
      .eq("id", campaign.id);
    if (campaignError) return onError(campaignError.message);
    const { error: assetsError } = await supabase
      .from("campaign_assets")
      .update({ approval_status: "pending" })
      .eq("campaign_id", campaign.id);
    if (assetsError) {
      onError(
        `Sign-off was cleared, but assets could not be reset to pending: ${assetsError.message}`,
      );
    }
    router.refresh();
  }

  function uploadCover(files: FileList) {
    const file = files[0];
    if (!file) return;
    upload.run(file, "Cover upload failed", async (url, supabase) => {
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ cover_image_url: url })
        .eq("id", campaign.id);
      if (updateError) throw updateError;
    });
  }

  function addSlide(files: FileList) {
    const asset = selectedAsset;
    if (!asset) return onError("Select an asset to add carousel slides.");
    const file = files[0];
    if (!file) return;
    upload.run(file, "Slide upload failed", async (url, supabase) => {
      if (asset.type !== "carousel") {
        const { error: typeError } = await supabase
          .from("campaign_assets")
          .update({ type: "carousel" })
          .eq("id", asset.id);
        if (typeError) throw typeError;
      }

      const { error: slideError } = await supabase.from("campaign_asset_slides").insert({
        asset_id: asset.id,
        media_url: url,
        caption: null,
        sort_order: asset.campaign_asset_slides?.length || 0,
      });
      if (slideError) throw slideError;

      if (!asset.media_url) {
        const { error: mediaError } = await supabase
          .from("campaign_assets")
          .update({ media_url: url, thumbnail_url: url })
          .eq("id", asset.id);
        if (mediaError) {
          return `Slide added, but the asset thumbnail was not set: ${mediaError.message}`;
        }
      }
    });
  }

  async function removeAsset(assetId: string) {
    if (!window.confirm("Delete this asset?")) return;
    onError(null);
    const error = await deleteAsset(createClient(), assetId);
    if (error) return onError(error);
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    router.refresh();
  }

  function deleteComment(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    write((supabase) => supabase.from("campaign_comments").delete().eq("id", commentId));
  }

  const stats = [
    { label: "Assets", value: assets.length, tone: "border-blue-100 bg-blue-50 text-blue-800" },
    {
      label: "Approved",
      value: countWith("approved"),
      tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    {
      label: "Pending",
      value: countWith("pending"),
      tone: "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      label: "Feedback",
      value: feedbackCount,
      tone: "border-violet-100 bg-violet-50 text-violet-800",
    },
  ];

  return (
    <section ref={sectionRef} className="space-y-6 border-t border-line bg-subtle/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-fg">
            Manage {campaign.title}
          </h2>
          <p className="text-sm text-fg/55">
            Cover, assets, approvals, comments, and review access
            {campaign.review_disabled ? " · review disabled" : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className={softLinkClass}>
          Close
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-xl border p-3 text-center ${item.tone}`}>
            <p className="text-2xl font-bold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs font-medium opacity-80">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium text-fg">Campaign details</p>
          <button type="button" onClick={onEdit} className={softLinkClass}>
            Edit details
          </button>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Client">
            <dd className="text-fg">{campaign.clients?.name || "None"}</dd>
          </Detail>
          <Detail label="Project">
            <dd className="text-fg">{campaign.projects?.title || "None"}</dd>
          </Detail>
          <Detail label="Month">
            <dd className="text-fg">{campaign.month || "Not set"}</dd>
          </Detail>
          <Detail label="Status">
            <dd className="capitalize text-fg">{campaign.status}</dd>
          </Detail>
          <Detail label="Platforms" wide>
            <dd className="text-fg">{campaign.platforms || "Not set"}</dd>
          </Detail>
          {campaign.objectives ? (
            <Detail label="Objectives" wide>
              <dd className="whitespace-pre-wrap text-fg/80">{campaign.objectives}</dd>
            </Detail>
          ) : null}
          {campaign.notes ? (
            <Detail label="Internal notes" wide>
              <dd className="whitespace-pre-wrap text-fg/80">{campaign.notes}</dd>
            </Detail>
          ) : null}
          {campaign.published_at ? (
            <Detail label="Published" wide>
              <dd className="text-fg">{new Date(campaign.published_at).toLocaleDateString()}</dd>
            </Detail>
          ) : null}
        </dl>
        {!campaign.published_at ? (
          <button
            type="button"
            onClick={() =>
              updateCampaign({ published_at: new Date().toISOString(), status: "approved" })
            }
            className={`mt-4 ${primaryBtnClass}`}
          >
            Mark as published
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-subtle/40 p-4">
        <p className="text-sm font-medium text-fg">Cover image</p>
        {campaign.cover_image_url ? (
          <StorageImage
            src={campaign.cover_image_url}
            alt="Cover"
            className="mt-2 max-h-40 w-auto rounded-xl object-cover"
          />
        ) : (
          <p className="mt-1 text-xs text-fg/50">No cover yet</p>
        )}
        <DropUpload
          onFiles={uploadCover}
          accept="image/*"
          disabled={upload.uploading}
          className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface px-3 py-5 text-center text-sm text-fg/70"
        >
          {upload.uploading ? upload.label : "Drop cover image"}
        </DropUpload>
      </div>

      {campaign.client_decision ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p>
              Client decision: <strong>{campaign.client_decision}</strong>
              {campaign.client_approved_by_name ? ` by ${campaign.client_approved_by_name}` : ""}
            </p>
            {campaign.client_approved_at ? (
              <p className="mt-1 text-xs text-emerald-800/80">
                {new Date(campaign.client_approved_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className={`${controlRowClass} justify-end`}>
            <button type="button" onClick={resetForRevision} className={secondaryBtnClass}>
              Reset for revision
            </button>
            <button
              type="button"
              onClick={() => updateCampaign(CLEARED_DECISION)}
              className={secondaryBtnClass}
            >
              Clear decision
            </button>
          </div>
        </div>
      ) : null}

      <ReviewAccessCard
        campaign={campaign}
        write={write}
        copied={copied}
        onCopyLink={onCopyLink}
      />

      <AddAssetForm
        campaignId={campaign.id}
        nextSortOrder={assets.length}
        upload={upload}
        onError={onError}
        onCarouselCreated={setSelectedAssetId}
      />

      <div>
        <p className="mb-3 text-sm font-medium text-fg">
          Assets ({assets.length})
          {changesCount > 0 ? (
            <span className="ml-2 text-xs font-normal text-amber-700">
              {changesCount} need changes
            </span>
          ) : null}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {bySortOrder(assets).map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              selected={selectedAssetId === asset.id}
              onSelect={() => setSelectedAssetId(asset.id)}
              onEdit={() => {
                onError(null);
                setEditingAsset(asset);
              }}
              onDelete={() => removeAsset(asset.id)}
              onApprovalChange={(approval_status) =>
                write((supabase) =>
                  supabase.from("campaign_assets").update({ approval_status }).eq("id", asset.id),
                )
              }
              onRemoveSlide={(slideId) =>
                write((supabase) =>
                  supabase.from("campaign_asset_slides").delete().eq("id", slideId),
                )
              }
            />
          ))}
        </div>
      </div>

      {feedbackCount > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-medium text-fg">Client feedback ({feedbackCount})</p>
          <div className="mt-3 space-y-2">
            {assets.flatMap((asset) =>
              (asset.campaign_comments || []).map((comment) => (
                <div key={comment.id} className="rounded-xl bg-subtle/80 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-fg/55">
                      <span className="font-medium text-fg">{comment.author_name}</span>
                      {" on "}
                      {asset.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="mt-1 text-fg/75">{comment.body || "-"}</p>
                  <p className="mt-1 text-[10px] text-fg/45">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
              )),
            )}
          </div>
        </div>
      ) : null}

      {selectedAsset ? (
        <div className="rounded-xl border border-dashed border-fg/20 bg-subtle p-4">
          <p className="text-sm font-medium text-fg">
            Add carousel slide to “{selectedAsset.title}”
          </p>
          <DropUpload
            onFiles={addSlide}
            accept="image/*,video/*"
            disabled={upload.uploading}
            className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-fg/70"
          >
            {upload.uploading ? upload.label : "Drop slide media"}
          </DropUpload>
        </div>
      ) : null}

      {editingAsset ? (
        <AssetEditModal asset={editingAsset} onClose={() => setEditingAsset(null)} />
      ) : null}
    </section>
  );
}
