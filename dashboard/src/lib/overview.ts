import type { SupabaseClient } from "@supabase/supabase-js";

/** The studio's local time zone, used to decide which month "this month" is. */
const STUDIO_TIME_ZONE = "Asia/Kuwait";
const DEFAULT_CURRENCY = "KWD";
const CHART_MONTHS = 12;

export type OverviewActivity = {
  id: string;
  kind: "payment" | "lead" | "contract";
  text: string;
  date: string;
  href: string;
};

export type OverviewData = {
  /** Currency the money figures are shown in (the one with most invoices). */
  currency: string;
  /** True when invoices exist in other currencies that the figures leave out. */
  hasOtherCurrencies: boolean;
  collectedThisMonth: number;
  collectedLastMonth: number;
  outstanding: number;
  unpaidInvoices: number;
  overdue: number;
  overdueInvoices: number;
  clients: number;
  projects: number;
  publishedProjects: number;
  newLeads: number;
  openQuotations: number;
  contractsAwaitingSignature: number;
  /** Collected per month, oldest first, always CHART_MONTHS long. */
  revenueByMonth: { key: string; label: string; amount: number }[];
  activity: OverviewActivity[];
};

/** "2026-11-16" in the studio's time zone. */
function todayInStudio(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: STUDIO_TIME_ZONE });
}

/** The last `count` month keys ("2026-11"), oldest first, ending this month. */
function recentMonthKeys(today: string, count: number): string[] {
  const [year, month] = today.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en", {
    month: "short",
    timeZone: "UTC",
  });
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export async function loadOverview(supabase: SupabaseClient): Promise<OverviewData> {
  const today = todayInStudio();
  const monthKeys = recentMonthKeys(today, CHART_MONTHS);
  const count = { count: "exact" as const, head: true };

  const [
    invoices,
    payments,
    clients,
    projects,
    publishedProjects,
    newLeads,
    recentLeads,
    openQuotations,
    awaitingSignature,
    signedContracts,
  ] = await Promise.all([
    supabase.from("invoices").select("id, invoice_number, currency, status, total, amount_paid, due_date"),
    supabase
      .from("invoice_payments")
      .select("id, invoice_id, amount, currency, payment_date")
      .gte("payment_date", `${monthKeys[0]}-01`)
      .order("payment_date", { ascending: false }),
    supabase.from("clients").select("*", count),
    supabase.from("projects").select("*", count),
    supabase.from("projects").select("*", count).eq("is_visible", true),
    supabase.from("leads").select("*", count).eq("stage", "new"),
    supabase
      .from("leads")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("quotations").select("*", count).eq("status", "sent"),
    supabase.from("contracts").select("*", count).eq("status", "sent"),
    supabase
      .from("contracts")
      .select("id, title, signed_at")
      .eq("status", "signed")
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(5),
  ]);

  const liveInvoices = (invoices.data ?? []).filter((inv) => inv.status !== "cancelled");
  const currency =
    mostCommon(liveInvoices.map((inv) => inv.currency || DEFAULT_CURRENCY)) ?? DEFAULT_CURRENCY;
  const hasOtherCurrencies = liveInvoices.some(
    (inv) => (inv.currency || DEFAULT_CURRENCY) !== currency,
  );

  let outstanding = 0;
  let unpaidInvoices = 0;
  let overdue = 0;
  let overdueInvoices = 0;
  const invoiceNumbers = new Map<string, string>();
  for (const inv of liveInvoices) {
    invoiceNumbers.set(inv.id, inv.invoice_number);
    if ((inv.currency || DEFAULT_CURRENCY) !== currency || inv.status === "draft") continue;
    const balance = Number(inv.total || 0) - Number(inv.amount_paid || 0);
    if (balance <= 0) continue;
    outstanding += balance;
    unpaidInvoices += 1;
    if (inv.due_date && inv.due_date < today) {
      overdue += balance;
      overdueInvoices += 1;
    }
  }

  const byMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));
  for (const pay of payments.data ?? []) {
    if ((pay.currency || DEFAULT_CURRENCY) !== currency) continue;
    const key = String(pay.payment_date).slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(pay.amount || 0));
  }
  const revenueByMonth = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    amount: byMonth.get(key) ?? 0,
  }));

  const activity: OverviewActivity[] = [
    ...(payments.data ?? []).slice(0, 5).map((pay) => ({
      id: `payment-${pay.id}`,
      kind: "payment" as const,
      text: `Payment received on ${invoiceNumbers.get(pay.invoice_id) ?? "an invoice"}`,
      date: String(pay.payment_date),
      href: "/invoices",
    })),
    ...(recentLeads.data ?? []).map((lead) => ({
      id: `lead-${lead.id}`,
      kind: "lead" as const,
      text: `${lead.full_name} sent an enquiry`,
      date: String(lead.created_at),
      href: "/leads",
    })),
    ...(signedContracts.data ?? []).map((contract) => ({
      id: `contract-${contract.id}`,
      kind: "contract" as const,
      text: `${contract.title} was signed`,
      date: String(contract.signed_at),
      href: "/contracts",
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return {
    currency,
    hasOtherCurrencies,
    collectedThisMonth: revenueByMonth[CHART_MONTHS - 1].amount,
    collectedLastMonth: revenueByMonth[CHART_MONTHS - 2].amount,
    outstanding,
    unpaidInvoices,
    overdue,
    overdueInvoices,
    clients: clients.count ?? 0,
    projects: projects.count ?? 0,
    publishedProjects: publishedProjects.count ?? 0,
    newLeads: newLeads.count ?? 0,
    openQuotations: openQuotations.count ?? 0,
    contractsAwaitingSignature: awaitingSignature.count ?? 0,
    revenueByMonth,
    activity,
  };
}
