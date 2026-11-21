"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewAccessCard } from "@/components/campaigns/ReviewAccessCard";
import type { CampaignWrite } from "@/components/campaigns/hooks";
import { fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/ui/PageChrome";
import {
  createProjectFromCampaign,
  linkedProject,
  updateProjectFromCampaign,
} from "@/lib/campaignProject";
import {
  campaignStage,
  filesReleased,
  logCampaignEvent,
  type CampaignInvoice,
  type CampaignRow,
} from "@/lib/campaigns";
import { createClient } from "@/lib/supabase/client";
import type { CampaignEvent } from "@/lib/types";

const EVENT_LABELS: Record<string, string> = {
  viewed: "Opened the review link",
  post_approved: "Approved a post",
  post_changes_requested: "Asked for changes on a post",
  comment: "Commented",
  voice_note: "Left a voice note",
  campaign_approved: "Approved the campaign",
  campaign_changes_requested: "Sent change requests",
  sent_for_review: "Sent for review",
  back_to_draft: "Moved back to draft",
  reopened: "Reopened the review",
  published: "Marked as published",
  unpublished: "Undid published",
  files_released: "Released the final files",
  files_held: "Took the final files back",
  files_downloaded: "Downloaded a final file",
};

const cardClass = "rounded-2xl border border-line bg-surface p-4";

/** Payment state of the campaign and whether the client can download the originals. */
function DeliveryCard({
  campaign,
  invoices,
  write,
}: {
  campaign: CampaignRow;
  invoices: CampaignInvoice[];
  write: CampaignWrite;
}) {
  const invoice = invoices.find((item) => item.id === campaign.invoice_id) ?? null;
  const released = filesReleased(campaign, invoice);
  const paidAutomatically = invoice?.status === "paid";

  const update = (values: Record<string, unknown>) =>
    write((supabase) => supabase.from("campaigns").update(values).eq("id", campaign.id));

  async function setReleased(next: boolean) {
    if (
      next &&
      !window.confirm(
        invoice
          ? `Invoice ${invoice.invoice_number} is not fully paid. Release the final files anyway?`
          : "Release the final files? The client will be able to download the originals.",
      )
    ) {
      return;
    }
    const saved = await update({ files_released_at: next ? new Date().toISOString() : null });
    if (saved) {
      await logCampaignEvent(createClient(), campaign.id, next ? "files_released" : "files_held");
    }
  }

  return (
    <div className={cardClass}>
      <p className="text-sm font-medium text-fg">Payment and final files</p>
      <p
        className={`mt-2 rounded-lg px-3 py-2 text-xs ${
          released ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
        }`}
      >
        {released
          ? "Released. The client can download the original files from the review link."
          : "Protected. The client sees smaller review copies and cannot download the originals."}
      </p>

      <label className="mt-3 flex flex-col gap-1.5 text-xs font-medium text-fg/65">
        Invoice for this campaign
        <select
          value={campaign.invoice_id ?? ""}
          onChange={(e) => update({ invoice_id: e.target.value || null })}
          className={fieldClass}
        >
          <option value="">No invoice linked</option>
          {invoices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.invoice_number} · {item.currency} {Number(item.total).toFixed(2)} ·{" "}
              {item.status}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs text-fg/50">
        {invoice
          ? paidAutomatically
            ? "This invoice is paid, so the files are released automatically."
            : "Files release automatically when this invoice is fully paid."
          : "Link an invoice to release the files automatically once it is paid."}
      </p>

      {paidAutomatically ? null : released ? (
        <button
          type="button"
          onClick={() => setReleased(false)}
          className={`mt-3 w-full ${secondaryBtnClass}`}
        >
          Take files back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setReleased(true)}
          className={`mt-3 w-full ${primaryBtnClass}`}
        >
          Release final files now
        </button>
      )}
    </div>
  );
}

type LinkedProject = { id: string; title: string; is_visible: boolean };

/** Shows the campaign in the public portfolio, only when the owner asks for it. */
function PortfolioCard({ campaign }: { campaign: CampaignRow }) {
  const router = useRouter();
  const [project, setProject] = useState<LinkedProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const stage = campaignStage(campaign);
  const approved = stage === "approved" || stage === "published";

  useEffect(() => {
    let active = true;
    void linkedProject(createClient(), campaign).then((found) => {
      if (active) setProject(found);
    });
    return () => {
      active = false;
    };
  }, [campaign]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (caught) {
      setMessage({
        text: caught instanceof Error ? caught.message : "Something went wrong.",
        error: true,
      });
    }
    setBusy(false);
  }

  const publish = () =>
    run(async () => {
      const id = await createProjectFromCampaign(createClient(), campaign);
      router.push(`/projects/${id}`);
    });

  const update = () =>
    run(async () => {
      if (!project) return;
      const { added, removed } = await updateProjectFromCampaign(
        createClient(),
        campaign,
        project.id,
      );
      setMessage({
        text:
          added || removed
            ? `Project updated: ${added} added, ${removed} removed.`
            : "The project already matches this campaign.",
      });
    });

  return (
    <div className={cardClass}>
      <p className="text-sm font-medium text-fg">Portfolio</p>
      {project ? (
        <>
          <p className="mt-2 text-xs text-fg/60">
            Published as the project{" "}
            <Link href={`/projects/${project.id}`} className="font-medium text-fg underline">
              {project.title}
            </Link>{" "}
            ({project.is_visible ? "on the website" : "still a draft"}). Changes here reach it
            only when you update it.
          </p>
          <button
            type="button"
            onClick={update}
            disabled={busy}
            className={`mt-3 w-full ${secondaryBtnClass}`}
          >
            {busy ? "Updating…" : "Update project from campaign"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-fg/60">
            {approved
              ? "Make a draft project from this campaign's posts. You check it and publish it from Projects."
              : "Once the client approves this campaign, you can make a portfolio project from it."}
          </p>
          <button
            type="button"
            onClick={publish}
            disabled={busy || !approved}
            className={`mt-3 w-full ${primaryBtnClass}`}
          >
            {busy ? "Creating project…" : "Publish as project"}
          </button>
        </>
      )}
      {message ? (
        <p
          role={message.error ? "alert" : "status"}
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            message.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** Everything the client and the studio did on this review, newest first. */
function ActivityCard({ events, freshIds }: { events: CampaignEvent[]; freshIds: string[] }) {
  return (
    <div className={cardClass}>
      <p className="text-sm font-medium text-fg">Activity record</p>
      <p className="mt-1 text-xs text-fg/50">
        Kept as proof of what was said and when. It cannot be edited.
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-xs text-fg/50">Nothing yet.</p>
      ) : (
        <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
          {events.map((event) => (
            <li key={event.id} className="text-xs">
              <p className="text-fg/85">
                <span className="font-medium text-fg">{event.actor_name || "Client"}</span>
                {" · "}
                {EVENT_LABELS[event.kind] ?? event.kind}
                {freshIds.includes(event.id) ? (
                  <span className="ml-1.5 rounded-full bg-fg px-1.5 py-px text-[10px] font-semibold text-canvas">
                    New
                  </span>
                ) : null}
              </p>
              {event.detail ? (
                <p className="mt-0.5 line-clamp-3 text-fg/60">{event.detail}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-fg/40">
                {new Date(event.created_at).toLocaleString()}
                {event.ip ? ` · ${event.ip}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function CampaignSidebar({
  campaign,
  invoices,
  events,
  freshEventIds,
  write,
  copied,
  onCopyLink,
}: {
  campaign: CampaignRow;
  invoices: CampaignInvoice[];
  events: CampaignEvent[];
  /** Events the client added since the studio's last visit. */
  freshEventIds: string[];
  write: CampaignWrite;
  copied: boolean;
  onCopyLink: () => void;
}) {
  return (
    <aside className="space-y-4">
      <ReviewAccessCard
        campaign={campaign}
        write={write}
        copied={copied}
        onCopyLink={() => onCopyLink()}
      />
      <DeliveryCard campaign={campaign} invoices={invoices} write={write} />
      <PortfolioCard campaign={campaign} />
      <ActivityCard events={events} freshIds={freshEventIds} />
    </aside>
  );
}
