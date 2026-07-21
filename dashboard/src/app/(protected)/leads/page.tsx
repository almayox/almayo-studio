import { LeadsManager } from "@/components/LeadsManager";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return <LeadsManager initialLeads={(data as Lead[]) ?? []} />;
}
