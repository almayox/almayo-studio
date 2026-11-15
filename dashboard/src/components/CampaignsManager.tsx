"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import {
  EmptyState,
  PageHeader,
  SummaryCards,
  controlRowClass,
  fieldClass,
  inlineSelectClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
  ActionGroup,
  softLinkClass,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { Copy, Eye, EyeOff, Pencil, Settings2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import { hashPassword } from "@/lib/password";
import { StorageImage, StorageVideo } from "@/components/StorageMedia";
import { publicSiteUrl } from "@/lib/siteUrl";
import type {
  Campaign,
  CampaignAsset,
  CampaignAssetSlide,
  CampaignComment,
  Client,
} from "@/lib/types";

type AssetRow = CampaignAsset & {
  campaign_asset_slides?: CampaignAssetSlide[];
  campaign_comments?: CampaignComment[];
};

type CampaignRow = Campaign & {
  clients?: Pick<Client, "name"> | null;
  projects?: { id: string; title: string } | null;
  campaign_assets?: AssetRow[];
};

function token() {
  return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
}

export function CampaignsManager({
  initialCampaigns,
  clients,
  projects,
  fetchError,
}: {
  initialCampaigns: CampaignRow[];
  clients: Client[];
  projects: { id: string; title: string }[];
  fetchError?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState("");
  const [objectives, setObjectives] = useState("");
  const [platforms, setPlatforms] = useState("Instagram, TikTok");
  const [notes, setNotes] = useState("");
  const [reviewPassword, setReviewPassword] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetTitle, setAssetTitle] = useState("");
  const [assetCaption, setAssetCaption] = useState("");
  const [assetHashtags, setAssetHashtags] = useState("");
  const [assetPublishDate, setAssetPublishDate] = useState("");
  const [assetNotes, setAssetNotes] = useState("");
  const [assetType, setAssetType] = useState<"single" | "carousel" | "video" | "reel" | "story">("single");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [expiryDraft, setExpiryDraft] = useState("");
  const [assetEditOpen, setAssetEditOpen] = useState(false);
  const [assetEditId, setAssetEditId] = useState<string | null>(null);
  const [assetEditForm, setAssetEditForm] = useState({
    title: "",
    caption: "",
    hashtags: "",
    publishDate: "",
    notes: "",
    type: "single" as "single" | "carousel" | "video" | "reel" | "story",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const manageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedCampaign || !manageRef.current) return;
    manageRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedCampaign]);

  const campaign = useMemo(
    () => initialCampaigns.find((c) => c.id === selectedCampaign) || null,
    [initialCampaigns, selectedCampaign],
  );

  // Keep the expiry draft in sync with the selected campaign (also after a
  // refresh delivers new data). Adjusted during render instead of in an effect.
  const [expirySource, setExpirySource] = useState<CampaignRow | null>(campaign);
  if (expirySource !== campaign) {
    setExpirySource(campaign);
    setExpiryDraft(
      campaign?.review_token_expires_at
        ? campaign.review_token_expires_at.slice(0, 10)
        : "",
    );
  }

  const selectedAsset = useMemo(
    () => campaign?.campaign_assets?.find((a) => a.id === selectedAssetId) || null,
    [campaign, selectedAssetId],
  );

  const filteredCampaigns = useMemo(() => {
    let rows = filterBySearch(initialCampaigns, search, (row) =>
      [row.title, row.clients?.name, row.month, row.platforms, row.status]
        .filter(Boolean)
        .join(" "),
    );
    if (statusFilter !== "all") {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    return rows;
  }, [initialCampaigns, search, statusFilter]);

  const pagination = usePagination(filteredCampaigns, 10);

  const manageAssets = campaign?.campaign_assets ?? [];
  const approvedAssetCount = manageAssets.filter((a) => a.approval_status === "approved").length;
  const pendingAssetCount = manageAssets.filter((a) => a.approval_status === "pending").length;
  const changesAssetCount = manageAssets.filter(
    (a) => a.approval_status === "changes_requested",
  ).length;
  const feedbackCount = manageAssets.reduce(
    (n, a) => n + (a.campaign_comments?.length ?? 0),
    0,
  );

  /** Shows a Supabase error in the page notice; returns true when there was one. */
  function failed(err: { message: string } | null | undefined) {
    if (!err) return false;
    setError(err.message);
    return true;
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setClientId("");
    setProjectId("");
    setMonth("");
    setObjectives("");
    setPlatforms("Instagram, TikTok");
    setNotes("");
    setReviewPassword("");
    setError(null);
  }

  function close() {
    setOpen(false);
    resetForm();
  }

  function startCreate() {
    resetForm();
    setOpen(true);
  }

  function startEdit(row: CampaignRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setClientId(row.client_id || "");
    setProjectId(row.project_id || "");
    setMonth(row.month || "");
    setObjectives(row.objectives || "");
    setPlatforms(row.platforms || "");
    setNotes(row.notes || "");
    setReviewPassword("");
    setError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      title,
      client_id: clientId || null,
      project_id: projectId || null,
      month: month || null,
      objectives: objectives || null,
      platforms: platforms || null,
      notes: notes || null,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("campaigns")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      if (reviewPassword.trim()) {
        const { error: passwordError } = await supabase
          .from("campaigns")
          .update({ review_password_hash: await hashPassword(reviewPassword.trim()) })
          .eq("id", editingId);
        if (passwordError) {
          setError(`Details saved, but the review password was not: ${passwordError.message}`);
          setSaving(false);
          return;
        }
      }
    } else {
      const review_password_hash = reviewPassword.trim()
        ? await hashPassword(reviewPassword.trim())
        : null;
      const { data: created, error: insertError } = await supabase
        .from("campaigns")
        .insert({
          ...payload,
          status: "draft",
          review_token: token(),
          review_password_hash,
          review_disabled: false,
        })
        .select("id")
        .single();
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      if (created?.id) {
        setSelectedCampaign(created.id);
        setSelectedAssetId(null);
      }
    }

    setSaving(false);
    close();
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", id);
    if (failed(updateError)) return;
    router.refresh();
  }

  async function savePassword() {
    if (!campaign) return;
    setError(null);
    const supabase = createClient();
    const review_password_hash = passwordDraft.trim()
      ? await hashPassword(passwordDraft.trim())
      : null;
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ review_password_hash })
      .eq("id", campaign.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPasswordDraft("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this campaign?")) return;
    setError(null);
    const supabase = createClient();
    const { data: assets, error: assetsError } = await supabase
      .from("campaign_assets")
      .select("id")
      .eq("campaign_id", id);
    if (failed(assetsError)) return;
    const assetIds = (assets || []).map((a) => a.id);
    if (assetIds.length) {
      const { error: slidesError } = await supabase
        .from("campaign_asset_slides")
        .delete()
        .in("asset_id", assetIds);
      if (failed(slidesError)) return;
      const { error: commentsError } = await supabase
        .from("campaign_comments")
        .delete()
        .in("asset_id", assetIds);
      if (failed(commentsError)) return;
    }
    const { error: assetDeleteError } = await supabase
      .from("campaign_assets")
      .delete()
      .eq("campaign_id", id);
    if (failed(assetDeleteError)) return;
    const { error: deleteError } = await supabase.from("campaigns").delete().eq("id", id);
    if (failed(deleteError)) return;
    if (selectedCampaign === id) {
      setSelectedCampaign(null);
      setSelectedAssetId(null);
    }
    if (editingId === id) close();
    router.refresh();
  }

  function reviewUrl(reviewToken: string) {
    return `${publicSiteUrl()}/review/${reviewToken}`;
  }

  async function copyLink(reviewToken: string) {
    const link = reviewUrl(reviewToken);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError(`Could not copy automatically. Review link: ${link}`);
      return;
    }
    setCopied(reviewToken);
    setTimeout(() => setCopied(null), 1500);
  }

  async function regenerateReviewToken() {
    if (!campaign) return;
    if (!window.confirm("Regenerate review link? The old link will stop working.")) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ review_token: token() })
      .eq("id", campaign.id);
    if (failed(updateError)) return;
    router.refresh();
  }

  async function clearPassword() {
    if (!campaign) return;
    if (!window.confirm("Remove review password?")) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ review_password_hash: null })
      .eq("id", campaign.id);
    if (failed(updateError)) return;
    setPasswordDraft("");
    router.refresh();
  }

  async function saveExpiry() {
    if (!campaign) return;
    setError(null);
    const supabase = createClient();
    const review_token_expires_at = expiryDraft
      ? new Date(`${expiryDraft}T23:59:59`).toISOString()
      : null;
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ review_token_expires_at })
      .eq("id", campaign.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function resetForRevision() {
    if (!campaign) return;
    if (
      !window.confirm(
        "Reset this campaign for revision? Client sign-off will clear and all assets go back to pending.",
      )
    ) {
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error: campaignError } = await supabase
      .from("campaigns")
      .update({
        client_decision: null,
        client_approved_by_name: null,
        client_approved_at: null,
        status: "review",
      })
      .eq("id", campaign.id);
    if (failed(campaignError)) return;
    const { error: assetsError } = await supabase
      .from("campaign_assets")
      .update({ approval_status: "pending" })
      .eq("campaign_id", campaign.id);
    if (assetsError) {
      setError(
        `Sign-off was cleared, but assets could not be reset to pending: ${assetsError.message}`,
      );
      router.refresh();
      return;
    }
    router.refresh();
  }

  async function publishCampaign() {
    if (!campaign) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ published_at: new Date().toISOString(), status: "approved" })
      .eq("id", campaign.id);
    if (failed(updateError)) return;
    router.refresh();
  }

  function startEditAsset(asset: AssetRow) {
    setAssetEditId(asset.id);
    setAssetEditForm({
      title: asset.title,
      caption: asset.caption || "",
      hashtags: asset.hashtags || "",
      publishDate: asset.publish_date || "",
      notes: asset.notes || "",
      type: (asset.type as typeof assetEditForm.type) || "single",
    });
    setError(null);
    setAssetEditOpen(true);
  }

  async function saveAssetEdit(event: FormEvent) {
    event.preventDefault();
    if (!assetEditId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaign_assets")
      .update({
        title: assetEditForm.title.trim(),
        caption: assetEditForm.caption.trim() || null,
        hashtags: assetEditForm.hashtags.trim() || null,
        publish_date: assetEditForm.publishDate || null,
        notes: assetEditForm.notes.trim() || null,
        type: assetEditForm.type,
      })
      .eq("id", assetEditId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setAssetEditOpen(false);
    setAssetEditId(null);
    router.refresh();
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("campaign_comments")
      .delete()
      .eq("id", commentId);
    if (failed(deleteError)) return;
    router.refresh();
  }

  async function toggleReviewDisabled(row: CampaignRow) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ review_disabled: !row.review_disabled })
      .eq("id", row.id);
    if (failed(updateError)) return;
    router.refresh();
  }

  async function uploadCover(files: FileList) {
    if (!campaign) return;
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadPhase("uploading");
    setError(null);
    try {
      const publicUrl = await uploadToStorage(file);
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ cover_image_url: publicUrl })
        .eq("id", campaign.id);
      if (updateError) throw updateError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  }

  async function setAssetApproval(assetId: string, approval_status: string) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaign_assets")
      .update({ approval_status })
      .eq("id", assetId);
    if (failed(updateError)) return;
    router.refresh();
  }

  async function clearClientDecision() {
    if (!campaign) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        client_decision: null,
        client_approved_by_name: null,
        client_approved_at: null,
      })
      .eq("id", campaign.id);
    if (failed(updateError)) return;
    router.refresh();
  }

  async function uploadToStorage(file: File) {
    if (!selectedCampaign) throw new Error("Select a campaign first.");
    return uploadStudioFile(file, {
      folder: `campaigns/${selectedCampaign}`,
      onPhase: setUploadPhase,
    });
  }

  async function createAssetWithMedia(files: FileList) {
    if (!selectedCampaign || !assetTitle.trim()) {
      setError("Select a campaign and enter an asset title first.");
      return;
    }
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadPhase("uploading");
    setError(null);
    try {
      const publicUrl = await uploadToStorage(file);
      const supabase = createClient();
      const sortOrder = campaign?.campaign_assets?.length || 0;
      const type =
        assetType === "video" || assetType === "reel" || file.type.startsWith("video/")
          ? assetType === "reel"
            ? "reel"
            : "video"
          : assetType === "carousel"
            ? "carousel"
            : "single";

      const { data: asset, error: insertError } = await supabase
        .from("campaign_assets")
        .insert({
          campaign_id: selectedCampaign,
          title: assetTitle.trim(),
          caption: assetCaption || null,
          hashtags: assetHashtags.trim() || null,
          publish_date: assetPublishDate || null,
          notes: assetNotes.trim() || null,
          media_url: publicUrl,
          thumbnail_url: publicUrl,
          type,
          sort_order: sortOrder,
          approval_status: "pending",
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      let slideWarning: string | null = null;
      if (type === "carousel" && asset) {
        const { error: slideError } = await supabase.from("campaign_asset_slides").insert({
          asset_id: asset.id,
          media_url: publicUrl,
          caption: assetCaption || null,
          sort_order: 0,
        });
        if (slideError) {
          slideWarning = `Asset created, but its first slide was not saved: ${slideError.message}`;
        }
        setSelectedAssetId(asset.id);
      }

      setAssetTitle("");
      setAssetCaption("");
      setAssetHashtags("");
      setAssetPublishDate("");
      setAssetNotes("");
      if (slideWarning) setError(slideWarning);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  }

  async function addSlideToAsset(files: FileList) {
    if (!selectedAsset) {
      setError("Select an asset to add carousel slides.");
      return;
    }
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadPhase("uploading");
    setError(null);
    try {
      const publicUrl = await uploadToStorage(file);
      const supabase = createClient();
      const nextOrder = selectedAsset.campaign_asset_slides?.length || 0;

      if (selectedAsset.type !== "carousel") {
        const { error: typeError } = await supabase
          .from("campaign_assets")
          .update({ type: "carousel" })
          .eq("id", selectedAsset.id);
        if (typeError) throw typeError;
      }

      const { error: slideError } = await supabase.from("campaign_asset_slides").insert({
        asset_id: selectedAsset.id,
        media_url: publicUrl,
        caption: null,
        sort_order: nextOrder,
      });
      if (slideError) throw slideError;

      if (!selectedAsset.media_url) {
        const { error: mediaError } = await supabase
          .from("campaign_assets")
          .update({ media_url: publicUrl, thumbnail_url: publicUrl })
          .eq("id", selectedAsset.id);
        if (mediaError) {
          setError(`Slide added, but the asset thumbnail was not set: ${mediaError.message}`);
        }
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slide upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  }

  async function removeAsset(assetId: string) {
    if (!window.confirm("Delete this asset?")) return;
    setError(null);
    const supabase = createClient();
    const { error: slidesError } = await supabase
      .from("campaign_asset_slides")
      .delete()
      .eq("asset_id", assetId);
    if (failed(slidesError)) return;
    const { error: commentsError } = await supabase
      .from("campaign_comments")
      .delete()
      .eq("asset_id", assetId);
    if (failed(commentsError)) return;
    const { error: deleteError } = await supabase
      .from("campaign_assets")
      .delete()
      .eq("id", assetId);
    if (failed(deleteError)) return;
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    router.refresh();
  }

  async function removeSlide(slideId: string) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("campaign_asset_slides")
      .delete()
      .eq("id", slideId);
    if (failed(deleteError)) return;
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description="Build creative packs, share review links, collect client decisions."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            New campaign
          </button>
        }
      />

      {fetchError ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Could not load full campaign data: {fetchError}. Run{" "}
          <code className="rounded bg-white px-1">schema_updates.sql</code> in Supabase if
          carousel slides are missing.
        </p>
      ) : null}

      {!open && !assetEditOpen && error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search campaigns, client, month…"
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={[
          { value: "draft", label: "Draft" },
          { value: "review", label: "In review" },
          { value: "approved", label: "Approved" },
          { value: "changes_requested", label: "Changes requested" },
        ]}
      />

      <SummaryCards
        items={[
          { label: "Total", value: initialCampaigns.length, tone: "blue" },
          {
            label: "In review",
            value: initialCampaigns.filter((c) => c.status === "review").length,
            tone: "yellow",
          },
          {
            label: "Approved",
            value: initialCampaigns.filter((c) => c.status === "approved").length,
            tone: "green",
          },
          {
            label: "Assets",
            value: initialCampaigns.reduce(
              (n, c) => n + (c.campaign_assets?.length || 0),
              0,
            ),
            tone: "purple",
          },
        ]}
      />

      {filteredCampaigns.length === 0 ? (
        <EmptyState
          message={
            initialCampaigns.length === 0
              ? "No campaigns yet. Create your first creative pack."
              : "No campaigns match your filters."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-mist bg-foam text-xs uppercase tracking-wide text-navy/60">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {pagination.pageItems.map((row) => (
                <tr
                  key={row.id}
                  className={`align-middle hover:bg-foam/40 ${
                    selectedCampaign === row.id ? "bg-foam/70" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{row.title}</p>
                    <p className="text-xs text-navy/50">
                      {row.clients?.name || "No client"} · {row.campaign_assets?.length || 0}{" "}
                      assets
                      {row.review_password_hash ? " · password" : ""}
                      {row.review_disabled ? " · review off" : ""}
                    </p>
                    {row.client_decision ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Decision: {row.client_decision}
                        {row.client_approved_by_name
                          ? ` by ${row.client_approved_by_name}`
                          : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      className={inlineSelectClass}
                    >
                      {["draft", "review", "approved", "changes_requested"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <ActionGroup>
                      <ActionButton
                        icon={Settings2}
                        label="Manage"
                        onClick={() => {
                          setSelectedCampaign(row.id);
                          setSelectedAssetId(null);
                          setPasswordDraft("");
                          setError(null);
                        }}
                      />
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => startEdit(row)}
                      />
                      <ActionButton
                        icon={Copy}
                        label="Copy review link"
                        title={copied === row.review_token ? "Copied!" : "Copy review link"}
                        onClick={() => copyLink(row.review_token)}
                        disabled={row.review_disabled}
                      />
                      <ActionButton
                        icon={row.review_disabled ? Eye : EyeOff}
                        label={row.review_disabled ? "Enable review" : "Disable review"}
                        onClick={() => toggleReviewDisabled(row)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => remove(row.id)}
                      />
                    </ActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {campaign ? (
            <section
              ref={manageRef}
              className="space-y-6 border-t border-mist bg-foam/20 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl text-navy">
                    Manage {campaign.title}
                  </h2>
                  <p className="text-sm text-navy/55">
                    Cover, assets, approvals, comments, and review access
                    {campaign.review_disabled ? " · review disabled" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCampaign(null);
                    setSelectedAssetId(null);
                    setError(null);
                  }}
                  className={softLinkClass}
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Assets", value: manageAssets.length, tone: "border-blue-100 bg-blue-50 text-blue-800" },
                  { label: "Approved", value: approvedAssetCount, tone: "border-emerald-100 bg-emerald-50 text-emerald-800" },
                  { label: "Pending", value: pendingAssetCount, tone: "border-amber-100 bg-amber-50 text-amber-800" },
                  { label: "Feedback", value: feedbackCount, tone: "border-violet-100 bg-violet-50 text-violet-800" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-3 text-center ${item.tone}`}>
                    <p className="text-2xl font-bold tabular-nums">{item.value}</p>
                    <p className="mt-1 text-xs font-medium opacity-80">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-mist bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-navy">Campaign details</p>
                  <button type="button" onClick={() => startEdit(campaign)} className={softLinkClass}>
                    Edit details
                  </button>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-navy/50">Client</dt>
                    <dd className="text-navy">{campaign.clients?.name || "None"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/50">Project</dt>
                    <dd className="text-navy">{campaign.projects?.title || "None"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/50">Month</dt>
                    <dd className="text-navy">{campaign.month || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-navy/50">Status</dt>
                    <dd className="capitalize text-navy">{campaign.status}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-navy/50">Platforms</dt>
                    <dd className="text-navy">{campaign.platforms || "Not set"}</dd>
                  </div>
                  {campaign.objectives ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-navy/50">Objectives</dt>
                      <dd className="whitespace-pre-wrap text-navy/80">{campaign.objectives}</dd>
                    </div>
                  ) : null}
                  {campaign.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-navy/50">Internal notes</dt>
                      <dd className="whitespace-pre-wrap text-navy/80">{campaign.notes}</dd>
                    </div>
                  ) : null}
                  {campaign.published_at ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-navy/50">Published</dt>
                      <dd className="text-navy">
                        {new Date(campaign.published_at).toLocaleDateString()}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {!campaign.published_at ? (
                  <button
                    type="button"
                    onClick={publishCampaign}
                    className={`mt-4 ${primaryBtnClass}`}
                  >
                    Mark as published
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-mist bg-foam/40 p-4">
                <p className="text-sm font-medium text-navy">Cover image</p>
            {campaign.cover_image_url ? (
              <StorageImage
                src={campaign.cover_image_url}
                alt="Cover"
                className="mt-2 max-h-40 w-auto rounded-xl object-cover"
              />
            ) : (
              <p className="mt-1 text-xs text-navy/50">No cover yet</p>
            )}
            <DropUpload
              onFiles={uploadCover}
              accept="image/*"
              disabled={uploading}
              className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-mist bg-white px-3 py-5 text-center text-sm text-navy/70"
            >
              {uploading ? uploadStatusLabel(uploadPhase) : "Drop cover image"}
            </DropUpload>
          </div>

          {campaign.client_decision ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p>
                  Client decision: <strong>{campaign.client_decision}</strong>
                  {campaign.client_approved_by_name
                    ? ` by ${campaign.client_approved_by_name}`
                    : ""}
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
                <button type="button" onClick={clearClientDecision} className={secondaryBtnClass}>
                  Clear decision
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-mist bg-white p-4">
            <p className="text-sm font-medium text-navy">Client review link</p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-foam px-3 py-2 text-xs text-navy/80">
              {reviewUrl(campaign.review_token)}
            </code>
            <div className={`mt-3 ${controlRowClass}`}>
              <button type="button" onClick={() => copyLink(campaign.review_token)} className={secondaryBtnClass}>
                {copied === campaign.review_token ? "Copied" : "Copy link"}
              </button>
              <a
                href={reviewUrl(campaign.review_token)}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryBtnClass}
              >
                Open
              </a>
              <button
                type="button"
                onClick={() => toggleReviewDisabled(campaign)}
                className={secondaryBtnClass}
              >
                {campaign.review_disabled ? "Enable review" : "Disable review"}
              </button>
              <button type="button" onClick={regenerateReviewToken} className={secondaryBtnClass}>
                New link
              </button>
            </div>
            {campaign.review_disabled ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Review link is disabled. Clients cannot access this campaign.
              </p>
            ) : null}

            <div className="mt-4 border-t border-mist pt-4">
              <p className="text-sm font-medium text-navy">
                Review password{" "}
                <span className="font-normal text-navy/50">
                  {campaign.review_password_hash ? "(set)" : "(none)"}
                </span>
              </p>
              <div className={`mt-2 ${controlRowClass}`}>
                <input
                  type="password"
                  value={passwordDraft}
                  onChange={(e) => setPasswordDraft(e.target.value)}
                  placeholder="New password"
                  className={`min-w-0 flex-1 ${fieldClass}`}
                />
                <button type="button" onClick={savePassword} className={primaryBtnClass}>
                  Save
                </button>
                {campaign.review_password_hash ? (
                  <button type="button" onClick={clearPassword} className={secondaryBtnClass}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 border-t border-mist pt-4">
              <p className="text-sm font-medium text-navy">Link expiry</p>
              <div className={`mt-2 ${controlRowClass}`}>
                <input
                  type="date"
                  value={expiryDraft}
                  onChange={(e) => setExpiryDraft(e.target.value)}
                  className={`min-w-0 flex-1 ${fieldClass}`}
                />
                <button type="button" onClick={saveExpiry} className={secondaryBtnClass}>
                  {expiryDraft ? "Set expiry" : "Clear expiry"}
                </button>
              </div>
              {campaign.review_token_expires_at ? (
                <p className="mt-2 text-xs text-amber-700">
                  Expires {new Date(campaign.review_token_expires_at).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-mist bg-foam/40 p-4">
            <p className="text-sm font-medium text-navy">Add asset</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={`${labelClass} sm:col-span-1`}>
              Asset title
              <input
                value={assetTitle}
                onChange={(e) => setAssetTitle(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Caption
              <input
                value={assetCaption}
                onChange={(e) => setAssetCaption(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Type
              <select
                value={assetType}
                onChange={(e) =>
                  setAssetType(
                    e.target.value as "single" | "carousel" | "video" | "reel" | "story",
                  )
                }
                className={fieldClass}
              >
                <option value="single">Single post</option>
                <option value="carousel">Carousel</option>
                <option value="reel">Reel</option>
                <option value="video">Video</option>
                <option value="story">Story</option>
              </select>
            </label>
            <label className={labelClass}>
              Publish date
              <input
                type="date"
                value={assetPublishDate}
                onChange={(e) => setAssetPublishDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Hashtags
              <input
                value={assetHashtags}
                onChange={(e) => setAssetHashtags(e.target.value)}
                placeholder="#brand #campaign"
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
              Internal notes
              <textarea
                rows={2}
                value={assetNotes}
                onChange={(e) => setAssetNotes(e.target.value)}
                className={`${fieldClass} !h-auto min-h-[5rem] max-h-none py-2.5`}
              />
            </label>
          </div>

          <DropUpload
            onFiles={createAssetWithMedia}
            accept="image/*,video/*"
            disabled={uploading}
            className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-mist bg-white px-4 py-8 text-center text-sm text-navy/70"
          >
            {uploading ? uploadStatusLabel(uploadPhase) : "Drop media to create asset"}
          </DropUpload>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">
              Assets ({manageAssets.length})
              {changesAssetCount > 0 ? (
                <span className="ml-2 text-xs font-normal text-amber-700">
                  {changesAssetCount} need changes
                </span>
              ) : null}
            </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(campaign.campaign_assets || [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((asset) => {
                const slides = (asset.campaign_asset_slides || [])
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order);
                const active = selectedAssetId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`rounded-xl border p-3 ${
                      active ? "border-navy/40 bg-foam/60" : "border-mist bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className="text-left"
                      >
                        <p className="font-medium text-navy">{asset.title}</p>
                        <p className="text-xs text-navy/50">
                          {asset.type}
                          {asset.publish_date ? ` · ${asset.publish_date}` : ""}
                          {" · "}
                          {slides.length} slide
                          {slides.length === 1 ? "" : "s"} · {asset.approval_status}
                          {(asset.campaign_comments || []).length
                            ? ` · ${(asset.campaign_comments || []).length} comment(s)`
                            : ""}
                        </p>
                        {asset.caption ? (
                          <p className="mt-1 line-clamp-2 text-xs text-navy/65">{asset.caption}</p>
                        ) : null}
                        {asset.hashtags ? (
                          <p className="mt-1 line-clamp-1 text-xs text-navy/55">{asset.hashtags}</p>
                        ) : null}
                        {asset.notes ? (
                          <p className="mt-1 line-clamp-2 text-xs italic text-navy/45">
                            {asset.notes}
                          </p>
                        ) : null}
                      </button>
                      <ActionButton
                        icon={Pencil}
                        label="Edit asset"
                        onClick={() => startEditAsset(asset)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => removeAsset(asset.id)}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["pending", "approved", "changes_requested"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setAssetApproval(asset.id, status)}
                          className={`inline-flex h-[var(--control-h)] items-center rounded-xl px-3 text-[11px] ${
                            asset.approval_status === status
                              ? "bg-navy text-white"
                              : "bg-foam text-navy/70 ring-1 ring-mist"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    {(asset.campaign_comments || []).length ? (
                      <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-navy/70">
                        {(asset.campaign_comments || [])
                          .slice()
                          .sort((a, b) => b.created_at.localeCompare(a.created_at))
                          .map((comment) => (
                            <li key={comment.id} className="rounded-xl bg-foam/80 px-2 py-1">
                              <span className="font-medium text-navy">{comment.author_name}:</span>{" "}
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
                              onClick={() => removeSlide(slide.id)}
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
              })}
          </div>
          </div>

          {feedbackCount > 0 ? (
            <div className="rounded-xl border border-mist bg-white p-4">
              <p className="text-sm font-medium text-navy">Client feedback ({feedbackCount})</p>
              <div className="mt-3 space-y-2">
                {manageAssets.flatMap((asset) =>
                  (asset.campaign_comments || []).map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-foam/80 px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-navy/55">
                          <span className="font-medium text-navy">{comment.author_name}</span>
                          {" on "}
                          {asset.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteComment(comment.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-1 text-navy/75">{comment.body || "-"}</p>
                      <p className="mt-1 text-[10px] text-navy/45">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  )),
                )}
              </div>
            </div>
          ) : null}

          {selectedAsset ? (
            <div className="rounded-xl border border-dashed border-navy/20 bg-foam p-4">
              <p className="text-sm font-medium text-navy">
                Add carousel slide to “{selectedAsset.title}”
              </p>
              <DropUpload
                onFiles={addSlideToAsset}
                accept="image/*,video/*"
                disabled={uploading}
                className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-mist bg-white px-4 py-6 text-center text-sm text-navy/70"
              >
                {uploading ? uploadStatusLabel(uploadPhase) : "Drop slide media"}
              </DropUpload>
            </div>
          ) : null}
            </section>
          ) : null}
          <PaginationBar
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.goTo}
            onPageSizeChange={pagination.changePageSize}
          />
        </div>
      )}

      {!open && !assetEditOpen && error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <Modal
        open={assetEditOpen}
        onClose={() => {
          setAssetEditOpen(false);
          setAssetEditId(null);
        }}
        title="Edit asset"
        description="Update post details, schedule, and internal notes."
      >
        <form onSubmit={saveAssetEdit} className="space-y-3">
          <label className={labelClass}>
            Title
            <input
              required
              value={assetEditForm.title}
              onChange={(e) => setAssetEditForm((f) => ({ ...f, title: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Type
            <select
              value={assetEditForm.type}
              onChange={(e) =>
                setAssetEditForm((f) => ({
                  ...f,
                  type: e.target.value as typeof f.type,
                }))
              }
              className={fieldClass}
            >
              <option value="single">Single post</option>
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
              <option value="video">Video</option>
              <option value="story">Story</option>
            </select>
          </label>
          <label className={labelClass}>
            Publish date
            <input
              type="date"
              value={assetEditForm.publishDate}
              onChange={(e) =>
                setAssetEditForm((f) => ({ ...f, publishDate: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Caption
            <textarea
              rows={3}
              value={assetEditForm.caption}
              onChange={(e) => setAssetEditForm((f) => ({ ...f, caption: e.target.value }))}
              className={`${fieldClass} !h-auto min-h-[5rem] max-h-none py-2.5`}
            />
          </label>
          <label className={labelClass}>
            Hashtags
            <input
              value={assetEditForm.hashtags}
              onChange={(e) => setAssetEditForm((f) => ({ ...f, hashtags: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Internal notes
            <textarea
              rows={2}
              value={assetEditForm.notes}
              onChange={(e) => setAssetEditForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${fieldClass} !h-auto min-h-[4.5rem] max-h-none py-2.5`}
            />
          </label>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAssetEditOpen(false);
                setAssetEditId(null);
              }}
              className={`flex-1 ${secondaryBtnClass}`}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : "Save asset"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit campaign" : "New campaign"}
        description="Campaign details and optional review password."
        wide
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Client
            <SearchSelect
              value={clientId}
              onChange={setClientId}
              placeholder="Search clients…"
              emptyLabel="Select client"
              options={clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
            />
          </label>
          <label className={labelClass}>
            Project
            <SearchSelect
              value={projectId}
              onChange={setProjectId}
              placeholder="Search projects…"
              emptyLabel="Select project"
              options={projects.map((project) => ({
                value: project.id,
                label: project.title,
              }))}
            />
          </label>
          <label className={labelClass}>
            Month
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="2026-07"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Platforms
            <input
              value={platforms}
              onChange={(e) => setPlatforms(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Objectives
            <textarea
              rows={3}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Internal notes
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Review password {editingId ? "(leave blank to keep)" : "(optional)"}
            <input
              type="password"
              value={reviewPassword}
              onChange={(e) => setReviewPassword(e.target.value)}
              className={fieldClass}
            />
          </label>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <p className="text-xs text-navy/50">
            After creating, click <strong>Manage</strong> on the row to add posts, carousels, or
            reels. Set status to <strong>review</strong>, then copy the review link.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save campaign" : "Create campaign"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
