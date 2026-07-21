import { createClient } from "@/lib/supabase/server";
import { OverviewDashboard } from "@/components/OverviewDashboard";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const supabase = await createClient();

  const [
    projectsTotal,
    projectsVisible,
    projectsFeatured,
    catalogsTotal,
    catalogsVisible,
    clientsTotal,
    clientsVisible,
    leadsTotal,
    leadsNew,
    leadsWon,
    leadsLost,
    invoicesRows,
    expensesRows,
    contractsTotal,
    campaignsTotal,
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("is_visible", true),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("is_featured", true),
    supabase.from("catalogs").select("*", { count: "exact", head: true }),
    supabase
      .from("catalogs")
      .select("*", { count: "exact", head: true })
      .eq("is_visible", true),
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("is_visible", true),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "won"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("stage", "lost"),
    supabase.from("invoices").select("total, amount_paid, status"),
    supabase.from("expenses").select("amount, currency"),
    supabase.from("contracts").select("*", { count: "exact", head: true }),
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
  ]);

  let invoiceCount = 0;
  let invoiceTotal = 0;
  let invoicePaid = 0;
  for (const row of invoicesRows.data ?? []) {
    if (row.status === "cancelled") continue;
    invoiceCount += 1;
    invoiceTotal += Number(row.total || 0);
    invoicePaid += Number(row.amount_paid || 0);
  }

  const expenseCount = expensesRows.data?.length ?? 0;
  const expenseByCurrency: Record<string, number> = {};
  for (const row of expensesRows.data ?? []) {
    const cur = row.currency || "KWD";
    expenseByCurrency[cur] = (expenseByCurrency[cur] || 0) + Number(row.amount || 0);
  }

  return (
    <OverviewDashboard
      stats={{
        projects: {
          total: projectsTotal.count ?? 0,
          visible: projectsVisible.count ?? 0,
          featured: projectsFeatured.count ?? 0,
        },
        catalogs: {
          total: catalogsTotal.count ?? 0,
          visible: catalogsVisible.count ?? 0,
        },
        clients: {
          total: clientsTotal.count ?? 0,
          visible: clientsVisible.count ?? 0,
        },
        leads: {
          total: leadsTotal.count ?? 0,
          new: leadsNew.count ?? 0,
          won: leadsWon.count ?? 0,
          lost: leadsLost.count ?? 0,
        },
        invoices: {
          count: invoiceCount,
          total: invoiceTotal,
          paid: invoicePaid,
        },
        expenses: {
          count: expenseCount,
          byCurrency: expenseByCurrency,
        },
        contracts: contractsTotal.count ?? 0,
        campaigns: campaignsTotal.count ?? 0,
      }}
    />
  );
}
