import { CampaignsManager } from "@/components/CampaignsManager";
import { createClient } from "@/lib/supabase/server";
import { withCurrentApprovalStatuses, type CampaignRow } from "@/lib/campaigns";
import type { Client } from "@/lib/types";

export const metadata = { title: "Campaigns" };

const FULL_SELECT =
  "*, clients(name), projects(id, title), campaign_assets(*, campaign_asset_slides(*), campaign_comments(*))";
const FALLBACK_SELECT =
  "*, clients(name), projects(id, title), campaign_assets(*, campaign_comments(*))";

export default async function CampaignsPage() {
  const supabase = await createClient();

  let campaigns = null;
  let fetchError: string | null = null;

  const full = await supabase
    .from("campaigns")
    .select(FULL_SELECT)
    .order("created_at", { ascending: false });

  if (full.error) {
    const fallback = await supabase
      .from("campaigns")
      .select(FALLBACK_SELECT)
      .order("created_at", { ascending: false });
    campaigns = fallback.data;
    fetchError = fallback.error?.message ?? full.error.message;
  } else {
    campaigns = full.data;
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .order("title", { ascending: true });

  return (
    <CampaignsManager
      initialCampaigns={withCurrentApprovalStatuses((campaigns as CampaignRow[]) ?? [])}
      clients={(clients as Client[]) ?? []}
      projects={(projects as { id: string; title: string }[]) ?? []}
      fetchError={fetchError}
    />
  );
}
