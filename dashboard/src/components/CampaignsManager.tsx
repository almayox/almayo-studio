"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { PostThumb } from "@/components/campaigns/PostThumb";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { EmptyState, PageHeader, primaryBtnClass } from "@/components/ui/PageChrome";
import {
  STAGES,
  STAGE_TONES,
  approvalCounts,
  campaignStage,
  monthLabel,
  stageLabel,
  type CampaignRow,
} from "@/lib/campaigns";
import { bySortOrder } from "@/lib/lineItems";
import type { Client } from "@/lib/types";

function CampaignCard({ campaign, unseen }: { campaign: CampaignRow; unseen: number }) {
  const assets = bySortOrder(campaign.campaign_assets);
  const counts = approvalCounts(assets);
  const stage = campaignStage(campaign);

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={`relative overflow-hidden rounded-2xl border bg-surface transition hover:border-fg/25 ${
        unseen ? "border-fg/50" : "border-line"
      }`}
    >
      {unseen ? (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-fg px-2.5 py-1 text-[11px] font-semibold text-canvas shadow">
          {unseen} new from client
        </span>
      ) : null}
      <div className="grid grid-cols-3 gap-px bg-line">
        {[0, 1, 2].map((index) => (
          <PostThumb key={index} asset={assets[index]} />
        ))}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg">{campaign.title}</p>
            <p className="truncate text-xs text-fg/55">
              {[campaign.clients?.name || "No client", monthLabel(campaign.month)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STAGE_TONES[stage]}`}
          >
            {stageLabel(stage)}
          </span>
        </div>
        <p className="text-xs text-fg/55">
          {counts.total === 0
            ? "No posts yet"
            : `${counts.approved} of ${counts.total} posts approved`}
          {counts.changes ? ` · ${counts.changes} need changes` : ""}
        </p>
      </div>
    </Link>
  );
}

export function CampaignsManager({
  initialCampaigns,
  clients,
  unseen,
  fetchError,
}: {
  initialCampaigns: CampaignRow[];
  clients: Pick<Client, "id" | "name">[];
  /** Unseen client actions per campaign id. */
  unseen: Record<string, number>;
  fetchError?: string | null;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const campaigns = useMemo(() => {
    const rows = filterBySearch(initialCampaigns, search, (row) =>
      [row.title, row.clients?.name, row.month, monthLabel(row.month), row.platforms]
        .filter(Boolean)
        .join(" "),
    );
    return stageFilter === "all" ? rows : rows.filter((row) => campaignStage(row) === stageFilter);
  }, [initialCampaigns, search, stageFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Send a month of content to a client, collect approval, release files when paid."
        action={
          <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
            New campaign
          </button>
        }
      />

      {fetchError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load campaigns: {fetchError}
        </p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search campaigns, client, month…"
        status={stageFilter}
        onStatusChange={setStageFilter}
        statusOptions={STAGES}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          message={
            initialCampaigns.length === 0
              ? "No campaigns yet. Create one, drop in the posts and send the review link."
              : "No campaigns match your filters."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} unseen={unseen[campaign.id] ?? 0} />
          ))}
        </div>
      )}

      {formOpen ? (
        <CampaignForm
          editing={null}
          clients={clients}
          onClose={() => setFormOpen(false)}
          onSaved={(createdId) => {
            setFormOpen(false);
            if (createdId) router.push(`/campaigns/${createdId}`);
            else router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
