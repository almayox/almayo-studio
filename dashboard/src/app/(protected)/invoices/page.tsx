import { InvoicesManager } from "@/components/InvoicesManager";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, LogoVariant } from "@/lib/types";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: clients }, { data: logos }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, invoice_items(*), invoice_payments(*), invoice_payment_events(*)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("name", { ascending: true }),
    supabase.from("logo_variants").select("*"),
  ]);

  const logoList = (logos as LogoVariant[]) ?? [];
  const logoUrl =
    logoList.find((l) => l.variant_type === "horizontal")?.url ||
    logoList.find((l) => l.variant_type === "navbar_on_light")?.url ||
    null;

  return (
    <InvoicesManager
      initialInvoices={(invoices as Invoice[]) ?? []}
      clients={(clients as Client[]) ?? []}
      logoUrl={logoUrl}
    />
  );
}
