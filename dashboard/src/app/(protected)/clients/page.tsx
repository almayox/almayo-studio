import { ClientsManager } from "@/components/ClientsManager";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientProjectSummary, ClientStats } from "@/lib/types";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const clients = (data as Client[]) ?? [];
  const ids = clients.map((c) => c.id);

  const [projects, contracts, invoices, campaigns] = await Promise.all([
    ids.length
      ? supabase
          .from("projects")
          .select("id, title, is_visible, client_id, catalogs(name)")
          .in("client_id", ids)
          .order("title", { ascending: true })
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("contracts").select("client_id").in("client_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("invoices").select("client_id").in("client_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("campaigns").select("client_id").in("client_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  function countByClient(rows: { client_id: string | null }[]) {
    const map: Record<string, number> = {};
    for (const row of rows) {
      if (!row.client_id) continue;
      map[row.client_id] = (map[row.client_id] || 0) + 1;
    }
    return map;
  }

  const projectCounts = countByClient((projects.data || []) as { client_id: string | null }[]);
  const contractCounts = countByClient((contracts.data || []) as { client_id: string | null }[]);
  const invoiceCounts = countByClient((invoices.data || []) as { client_id: string | null }[]);
  const campaignCounts = countByClient((campaigns.data || []) as { client_id: string | null }[]);

  type ProjectRow = {
    id: string;
    title: string;
    is_visible: boolean;
    client_id: string | null;
    catalogs: { name: string } | { name: string }[] | null;
  };
  const projectsByClient: Record<string, ClientProjectSummary[]> = {};
  for (const row of (projects.data || []) as unknown as ProjectRow[]) {
    if (!row.client_id) continue;
    const catalog = Array.isArray(row.catalogs) ? row.catalogs[0] : row.catalogs;
    (projectsByClient[row.client_id] ||= []).push({
      id: row.id,
      title: row.title,
      is_visible: row.is_visible,
      catalog_name: catalog?.name ?? null,
    });
  }

  const withStats: ClientStats[] = clients.map((client) => ({
    ...client,
    projects: projectsByClient[client.id] || [],
    project_count: projectCounts[client.id] || 0,
    contract_count: contractCounts[client.id] || 0,
    invoice_count: invoiceCounts[client.id] || 0,
    campaign_count: campaignCounts[client.id] || 0,
  }));

  return <ClientsManager initialClients={withStats} />;
}
