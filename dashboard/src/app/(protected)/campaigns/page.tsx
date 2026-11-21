import { CampaignsManager } from "@/components/CampaignsManager";
import { withCurrentApprovalStatuses, type CampaignRow } from "@/lib/campaigns";
import { unseenCountsByCampaign } from "@/lib/campaignActivity";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const supabase = await createClient();

  const [{ data: campaigns, error }, { data: clients }, unseen] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*, clients(name), campaign_assets(*)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    unseenCountsByCampaign(supabase),
  ]);

  return (
    <CampaignsManager
      initialCampaigns={withCurrentApprovalStatuses((campaigns as CampaignRow[]) ?? [])}
      clients={clients ?? []}
      unseen={unseen}
      fetchError={error?.message ?? null}
    />
  );
}
