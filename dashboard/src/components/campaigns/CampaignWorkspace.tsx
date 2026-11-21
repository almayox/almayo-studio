"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers, MessageCircle, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { CampaignSidebar } from "@/components/campaigns/CampaignSidebar";
import { NewPostDialog } from "@/components/campaigns/NewPostDialog";
import { PostEditor } from "@/components/campaigns/PostEditor";
import { PostThumb } from "@/components/campaigns/PostThumb";
import { useCampaignWrite } from "@/components/campaigns/hooks";
import { ActionButton } from "@/components/ui/ActionButton";
import { primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import {
  CLEARED_DECISION,
  addSlidesToPost,
  createPosts,
  fileFitsKind,
  moveItem,
  saveSortOrder,
  STAGES,
  STAGE_TONES,
  approvalCounts,
  campaignStage,
  deleteCampaign,
  logCampaignEvent,
  monthLabel,
  postKind,
  parsePlatforms,
  reviewUrl,
  stageLabel,
  type AssetRow,
  type CampaignInvoice,
  type CampaignRow,
  type CampaignStage,
} from "@/lib/campaigns";
import { SEEN_EVENT } from "@/lib/campaignActivity";
import { bySortOrder } from "@/lib/lineItems";
import { createClient } from "@/lib/supabase/client";
import type { CampaignEvent, Client } from "@/lib/types";

const APPROVAL_DOT: Record<string, string> = {
  approved: "bg-emerald-400",
  changes_requested: "bg-red-400",
  pending: "bg-amber-300",
};

const APPROVAL_TEXT: Record<string, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  pending: "Waiting for review",
};

function PostTile({
  asset,
  fresh,
  dragged,
  dropTarget,
  draggable,
  onOpen,
  dragHandlers,
}: {
  asset: AssetRow;
  /** True when the client did something on this post since the last visit. */
  fresh: boolean;
  /** True while this post is being dragged. */
  dragged: boolean;
  /** True while something is held over this post. */
  dropTarget: boolean;
  draggable: boolean;
  onOpen: () => void;
  dragHandlers: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const comments = asset.campaign_comments?.length ?? 0;
  const slides = asset.campaign_asset_slides?.length ?? 0;
  return (
    <button
      type="button"
      draggable={draggable}
      onClick={onOpen}
      {...dragHandlers}
      aria-label={`${asset.title}: ${APPROVAL_TEXT[asset.approval_status] ?? asset.approval_status}`}
      className={`group relative overflow-hidden bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg ${
        draggable ? "cursor-grab" : ""
      } ${dragged ? "opacity-40" : ""} ${dropTarget ? "ring-2 ring-inset ring-fg" : ""}`}
    >
      <PostThumb asset={asset} />
      <span
        className={`absolute left-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-black/40 ${
          APPROVAL_DOT[asset.approval_status] ?? "bg-fg/40"
        }`}
      />
      <span className="absolute right-2 top-2 text-white drop-shadow">
        {slides > 1 ? <Layers size={15} aria-hidden /> : null}
        {slides <= 1 && postKind(asset) === "reel" ? <Play size={15} aria-hidden /> : null}
      </span>
      {fresh ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-fg px-2 py-0.5 text-[11px] font-semibold text-canvas shadow">
          New
        </span>
      ) : null}
      {comments ? (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          <MessageCircle size={11} aria-hidden />
          {comments}
        </span>
      ) : null}
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
    </button>
  );
}

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

/** The five steps of a campaign, with the current one highlighted. */
function StageSteps({ stage }: { stage: CampaignStage }) {
  // "Changes requested" is a detour between review and approval, not a step of its own.
  const steps = STAGES.filter((item) => item.value !== "changes_requested");
  const current = stage === "changes_requested" ? "review" : stage;
  const currentIndex = steps.findIndex((item) => item.value === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {steps.map((step, index) => (
        <li key={step.value} className="flex items-center gap-2">
          <span
            className={
              index === currentIndex
                ? "font-semibold text-fg"
                : index < currentIndex
                  ? "text-fg/60"
                  : "text-fg/35"
            }
          >
            {index + 1}. {step.label}
          </span>
          {index < steps.length - 1 ? <span className="text-fg/25">→</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function CampaignWorkspace({
  campaign,
  clients,
  invoices,
  events,
  unseenEvents,
  setupNeeded,
}: {
  campaign: CampaignRow;
  clients: Pick<Client, "id" | "name">[];
  invoices: CampaignInvoice[];
  events: CampaignEvent[];
  /** What the client did since the studio last opened this campaign. */
  unseenEvents: CampaignEvent[];
  /** True when schema_campaign_review.sql has not been run yet. */
  setupNeeded: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Files for the new post dialog; an empty list opens it with nothing chosen. */
  const [newPostFiles, setNewPostFiles] = useState<File[] | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  /** What is being hovered while dragging: a post id, or "empty" for a free place. */
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // The order shown right after a drag, until the saved one arrives.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [orderSource, setOrderSource] = useState(campaign);
  if (orderSource !== campaign) {
    setOrderSource(campaign);
    setPendingOrder(null);
  }
  const write = useCampaignWrite(setError);

  // What was new when the page opened stays marked for this visit; the visit
  // itself is recorded so it is no longer new next time.
  const [fresh] = useState(unseenEvents);
  const freshPostIds = new Set(fresh.map((event) => event.asset_id).filter(Boolean));
  useEffect(() => {
    if (fresh.length) void logCampaignEvent(createClient(), campaign.id, SEEN_EVENT);
  }, [fresh, campaign.id]);

  const storedAssets = bySortOrder(campaign.campaign_assets);
  const assets = pendingOrder
    ? storedAssets
        .slice()
        .sort((a, b) => pendingOrder.indexOf(a.id) - pendingOrder.indexOf(b.id))
    : storedAssets;
  const counts = approvalCounts(assets);
  const stage = campaignStage(campaign);
  const locked = stage === "approved" || stage === "published";
  const openPost = assets.find((asset) => asset.id === openPostId) ?? null;
  const link = reviewUrl(campaign.review_token);
  const platformOptions = parsePlatforms(campaign.platforms);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(`Could not copy automatically. Review link: ${link}`);
    }
  }

  /** Moves a post to another place in the grid and saves the new order. */
  async function movePostTo(assetId: string, to: number) {
    const from = assets.findIndex((asset) => asset.id === assetId);
    if (from < 0 || to < 0 || to >= assets.length || from === to) return;
    const ordered = moveItem(assets, from, to);
    setPendingOrder(ordered.map((asset) => asset.id));
    setError(null);
    const problem = await saveSortOrder(createClient(), "campaign_assets", ordered);
    if (problem) setError(problem);
    router.refresh();
  }

  /** Files dropped on a free place: one file is a post straight away, several ask how. */
  async function dropOnEmpty(files: File[]) {
    const media = files.filter((file) => fileFitsKind(file, "carousel"));
    if (!media.length) return setError("Only images and videos can be added.");
    if (media.length > 1) return setNewPostFiles(media);
    setError(null);
    setUploadLabel("Uploading…");
    try {
      await createPosts(createClient(), campaign.id, media, {
        carousel: false,
        position: assets.length,
        onStatus: setUploadLabel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadLabel(null);
      router.refresh();
    }
  }

  /** Files dropped on a post are added to it as carousel slides. */
  async function dropOnPost(asset: AssetRow, files: File[]) {
    const media = files.filter((file) => fileFitsKind(file, "carousel"));
    if (!media.length) return setError("Only images and videos can be added.");
    if (postKind(asset) === "reel") {
      return setError("A reel is one video. Drop the files on a free place to add new posts.");
    }
    setError(null);
    setUploadLabel("Uploading…");
    try {
      const problem = await addSlidesToPost(
        createClient(),
        campaign.id,
        asset,
        media,
        setUploadLabel,
      );
      if (problem) setError(problem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadLabel(null);
      router.refresh();
    }
  }

  const canArrange = !locked && !uploadLabel;
  // Free places: always at least one, and enough to finish the last row.
  const emptyPlaces = locked ? 0 : 3 - (assets.length % 3);

  async function sendForReview() {
    if (!assets.length) return setError("Add at least one post before sending for review.");
    setError(null);
    const supabase = createClient();
    const { error: campaignError } = await supabase
      .from("campaigns")
      .update({
        ...CLEARED_DECISION,
        status: "review",
        review_disabled: false,
        review_sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
    if (campaignError) return setError(campaignError.message);
    // Posts the client asked to change go back to waiting; approved ones stay approved.
    const { error: assetsError } = await supabase
      .from("campaign_assets")
      .update({ approval_status: "pending" })
      .eq("campaign_id", campaign.id)
      .neq("approval_status", "approved");
    if (assetsError) setError(`Sent, but posts were not reset: ${assetsError.message}`);
    await logCampaignEvent(supabase, campaign.id, "sent_for_review");
    await copyLink();
    router.refresh();
  }

  async function setStage(
    values: Record<string, unknown>,
    eventKind: string,
    confirmMessage?: string,
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const saved = await write((supabase) =>
      supabase.from("campaigns").update(values).eq("id", campaign.id),
    );
    if (saved) await logCampaignEvent(createClient(), campaign.id, eventKind);
  }

  async function remove() {
    if (!window.confirm("Delete this campaign with all its posts and comments?")) return;
    setError(null);
    const deleteError = await deleteCampaign(createClient(), campaign.id);
    if (deleteError) return setError(deleteError);
    router.push("/campaigns");
    router.refresh();
  }

  const decisionLine = campaign.client_approved_at
    ? `${campaign.client_approved_by_name || "The client"} · ${new Date(
        campaign.client_approved_at,
      ).toLocaleString()}`
    : null;

  const stageInfo: Record<CampaignStage, { message: string; actions: React.ReactNode }> = {
    draft: {
      message: "Add the posts, then send the review link to the client.",
      actions: (
        <button type="button" onClick={sendForReview} className={primaryBtnClass}>
          Send for review
        </button>
      ),
    },
    review: {
      message: `Waiting for the client. ${counts.approved} of ${counts.total} posts approved so far.`,
      actions: (
        <>
          <button type="button" onClick={copyLink} className={primaryBtnClass}>
            {copied ? "Copied" : "Copy review link"}
          </button>
          <button
            type="button"
            onClick={() => setStage({ status: "draft" }, "back_to_draft")}
            className={secondaryBtnClass}
          >
            Back to draft
          </button>
        </>
      ),
    },
    changes_requested: {
      message: `The client asked for changes on ${counts.changes} post${
        counts.changes === 1 ? "" : "s"
      }${decisionLine ? ` (${decisionLine})` : ""}. Update them, then send again.`,
      actions: (
        <button type="button" onClick={sendForReview} className={primaryBtnClass}>
          Send again for review
        </button>
      ),
    },
    approved: {
      message: `Approved and locked${decisionLine ? ` by ${decisionLine}` : ""}. The client can no longer change anything.`,
      actions: (
        <>
          <button
            type="button"
            onClick={() =>
              setStage({ published_at: new Date().toISOString() }, "published")
            }
            className={primaryBtnClass}
          >
            Mark as published
          </button>
          <button
            type="button"
            onClick={() =>
              setStage(
                { ...CLEARED_DECISION, status: "review" },
                "reopened",
                "Reopen the review? The client's approval will be cleared and they can change their answers again.",
              )
            }
            className={secondaryBtnClass}
          >
            Reopen
          </button>
        </>
      ),
    },
    published: {
      message: `Published on ${
        campaign.published_at ? new Date(campaign.published_at).toLocaleDateString() : ""
      }.`,
      actions: (
        <button
          type="button"
          onClick={() => setStage({ published_at: null }, "unpublished")}
          className={secondaryBtnClass}
        >
          Undo published
        </button>
      ),
    },
  };

  return (
    <div className="space-y-5">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden /> Campaigns
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-fg sm:text-3xl">
              {campaign.title}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STAGE_TONES[stage]}`}
            >
              {stageLabel(stage)}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg/55">
            {[campaign.clients?.name || "No client", monthLabel(campaign.month), campaign.platforms]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex gap-1">
          <ActionButton icon={Pencil} label="Edit campaign" onClick={() => setEditing(true)} />
          <ActionButton icon={Trash2} label="Delete campaign" danger onClick={remove} />
        </div>
      </div>

      {setupNeeded ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Run <code className="rounded bg-surface px-1">supabase/schema_campaign_review.sql</code>{" "}
          in Supabase to turn on review copies, voice notes and the activity record.
        </p>
      ) : null}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <StageSteps stage={stage} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-fg/75">{stageInfo[stage].message}</p>
          <div className="flex flex-wrap gap-2">{stageInfo[stage].actions}</div>
        </div>
      </div>

      {fresh.length ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {fresh.length} new action{fresh.length === 1 ? "" : "s"} from the client since your last
          visit. The posts and activity lines are marked “New”.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-fg">Posts ({counts.total})</h2>
            <p className="text-xs text-fg/55">
              {uploadLabel ??
                `${counts.approved} approved · ${counts.changes} need changes · ${counts.pending} waiting`}
            </p>
          </div>
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-1">
            {assets.map((asset, index) => (
              <PostTile
                key={asset.id}
                asset={asset}
                fresh={freshPostIds.has(asset.id)}
                dragged={draggedId === asset.id}
                dropTarget={dropTarget === asset.id && draggedId !== asset.id}
                draggable={canArrange}
                onOpen={() => setOpenPostId(asset.id)}
                dragHandlers={{
                  onDragStart: (event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedId(asset.id);
                  },
                  onDragEnd: () => {
                    setDraggedId(null);
                    setDropTarget(null);
                  },
                  onDragOver: (event) => {
                    if (!canArrange || (!draggedId && !hasFiles(event))) return;
                    event.preventDefault();
                    setDropTarget(asset.id);
                  },
                  onDragLeave: () => setDropTarget(null),
                  onDrop: (event) => {
                    if (!canArrange) return;
                    event.preventDefault();
                    setDropTarget(null);
                    if (draggedId) {
                      movePostTo(draggedId, index);
                      setDraggedId(null);
                    } else if (event.dataTransfer.files.length) {
                      dropOnPost(asset, Array.from(event.dataTransfer.files));
                    }
                  },
                }}
              />
            ))}
            {Array.from({ length: emptyPlaces }, (_, index) => {
              const first = index === 0;
              // New posts always land in the first free place, so only that one lights up.
              const active = first && dropTarget === "empty";
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  disabled={Boolean(uploadLabel)}
                  onClick={() => setNewPostFiles([])}
                  onDragOver={(event) => {
                    if (!canArrange || (!draggedId && !hasFiles(event))) return;
                    event.preventDefault();
                    setDropTarget("empty");
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(event) => {
                    if (!canArrange) return;
                    event.preventDefault();
                    setDropTarget(null);
                    if (draggedId) {
                      // Dropping a post on a free place moves it to the end.
                      movePostTo(draggedId, assets.length - 1);
                      setDraggedId(null);
                    } else if (event.dataTransfer.files.length) {
                      dropOnEmpty(Array.from(event.dataTransfer.files));
                    }
                  }}
                  aria-label="Add post"
                  className={`flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-2 text-center text-xs transition ${
                    active
                      ? "border-fg bg-fg/10 text-fg"
                      : "border-line text-fg/50 hover:border-fg/30 hover:text-fg"
                  }`}
                >
                  {first ? (
                    <>
                      <Plus size={20} aria-hidden />
                      {uploadLabel ?? "Drop a file or click"}
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-fg/50">
            {locked
              ? "Approved campaigns are locked. Reopen the review to add or change posts."
              : "Drop a file on a dashed place to add a post, or on a post to make it a carousel. Drag posts to reorder them."}
          </p>
        </section>

        <CampaignSidebar
          campaign={campaign}
          invoices={invoices}
          events={events}
          freshEventIds={fresh.map((event) => event.id)}
          write={write}
          copied={copied}
          onCopyLink={copyLink}
        />
      </div>

      {openPost ? (
        <PostEditor
          key={openPost.id}
          asset={openPost}
          campaignId={campaign.id}
          position={assets.indexOf(openPost)}
          total={assets.length}
          platformOptions={platformOptions}
          locked={locked}
          onClose={() => setOpenPostId(null)}
        />
      ) : null}

      {newPostFiles ? (
        <NewPostDialog
          campaignId={campaign.id}
          position={assets.length}
          platformOptions={platformOptions}
          initialFiles={newPostFiles}
          onClose={() => setNewPostFiles(null)}
        />
      ) : null}

      {editing ? (
        <CampaignForm
          editing={campaign}
          clients={clients}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
