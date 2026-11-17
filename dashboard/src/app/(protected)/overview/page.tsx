import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/overview";
import { OverviewDashboard } from "@/components/OverviewDashboard";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const supabase = await createClient();
  return <OverviewDashboard data={await loadOverview(supabase)} />;
}
