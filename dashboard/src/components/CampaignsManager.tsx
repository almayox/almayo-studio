"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { CampaignPanel } from "@/components/campaigns/CampaignPanel";
import { CampaignsTable } from "@/components/campaigns/CampaignsTable";
import { useCampaignWrite } from "@/components/campaigns/hooks";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { EmptyState, PageHeader, SummaryCards, primaryBtnClass } from "@/components/ui/PageChrome";
import { PaginationControls, usePagination } from "@/components/ui/Pagination";
import {
  CAMPAIGN_STATUS_OPTIONS,
  deleteCampaign,
  reviewUrl,
  type CampaignRow,
} from "@/lib/campaigns";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

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
  /** The open form: `editing` is null for a new campaign. */
  const [form, setForm] = useState<{ editing: CampaignRow | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const write = useCampaignWrite(setError);

  const campaign = useMemo(
    () => initialCampaigns.find((c) => c.id === selectedId) || null,
    [initialCampaigns, selectedId],
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

  function openForm(editing: CampaignRow | null) {
    setError(null);
    setForm({ editing });
  }

  async function remove(row: CampaignRow) {
    if (!window.confirm("Delete this campaign?")) return;
    setError(null);
    const deleteError = await deleteCampaign(createClient(), row.id);
    if (deleteError) return setError(deleteError);
    if (selectedId === row.id) setSelectedId(null);
    router.refresh();
  }

  async function copyLink(reviewToken: string) {
    const link = reviewUrl(reviewToken);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError(`Could not copy automatically. Review link: ${link}`);
      return;
    }
    setCopiedToken(reviewToken);
    setTimeout(() => setCopiedToken(null), 1500);
  }

  const errorNotice = error ? (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  ) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description="Build creative packs, share review links, collect client decisions."
        action={
          <button type="button" onClick={() => openForm(null)} className={primaryBtnClass}>
            New campaign
          </button>
        }
      />

      {fetchError ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Could not load full campaign data: {fetchError}. Run{" "}
          <code className="rounded bg-surface px-1">schema_updates.sql</code> in Supabase if
          carousel slides are missing.
        </p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search campaigns, client, month…"
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={CAMPAIGN_STATUS_OPTIONS}
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
            value: initialCampaigns.reduce((n, c) => n + (c.campaign_assets?.length || 0), 0),
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
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <CampaignsTable
            rows={pagination.pageItems}
            selectedId={selectedId}
            copiedToken={copiedToken}
            onManage={(row) => {
              setSelectedId(row.id);
              setError(null);
            }}
            onEdit={openForm}
            onCopyLink={copyLink}
            onToggleReview={(row) =>
              write((supabase) =>
                supabase
                  .from("campaigns")
                  .update({ review_disabled: !row.review_disabled })
                  .eq("id", row.id),
              )
            }
            onDelete={remove}
            onStatusChange={(row, status) =>
              write((supabase) => supabase.from("campaigns").update({ status }).eq("id", row.id))
            }
          />

          {campaign ? (
            <CampaignPanel
              key={campaign.id}
              campaign={campaign}
              copied={copiedToken === campaign.review_token}
              onCopyLink={copyLink}
              onEdit={() => openForm(campaign)}
              onClose={() => {
                setSelectedId(null);
                setError(null);
              }}
              onError={setError}
            />
          ) : null}
          <PaginationControls pagination={pagination} />
        </div>
      )}

      {errorNotice}

      {form ? (
        <CampaignForm
          editing={form.editing}
          clients={clients}
          projects={projects}
          onClose={() => setForm(null)}
          onSaved={(createdId) => {
            setForm(null);
            if (createdId) setSelectedId(createdId);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
