import { notFound } from "next/navigation";
import { CampaignWorkspace } from "@/components/campaigns/CampaignWorkspace";
import {
  withCurrentApprovalStatuses,
  type CampaignInvoice,
  type CampaignRow,
} from "@/lib/campaigns";
import { SEEN_EVENT, unseenClientEvents } from "@/lib/campaignActivity";
import { createClient } from "@/lib/supabase/server";
import type { CampaignEvent } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, clients(name), campaign_assets(*, campaign_asset_slides(*), campaign_comments(*))")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const [{ data: clients }, { data: invoices }, events] = await Promise.all([
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    campaign.client_id
      ? supabase
          .from("invoices")
          .select("id, invoice_number, status, currency, total, amount_paid")
          .eq("client_id", campaign.client_id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("campaign_events")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const allEvents = (events.data as CampaignEvent[]) ?? [];

  return (
    <CampaignWorkspace
      campaign={withCurrentApprovalStatuses([campaign as CampaignRow])[0]}
      clients={clients ?? []}
      invoices={(invoices as CampaignInvoice[]) ?? []}
      // The studio's own visits are bookkeeping, not part of the record shown.
      events={allEvents.filter((event) => event.kind !== SEEN_EVENT)}
      unseenEvents={unseenClientEvents(allEvents)}
      // The record table comes from schema_campaign_review.sql.
      setupNeeded={Boolean(events.error)}
    />
  );
}
