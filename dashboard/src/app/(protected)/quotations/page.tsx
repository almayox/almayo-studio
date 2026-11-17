import { QuotationsManager } from "@/components/QuotationsManager";
import type { QuotationRow } from "@/lib/quotations";
import { PageHeader } from "@/components/ui/PageChrome";
import { createClient } from "@/lib/supabase/server";
import type { Client, LogoVariant, Project } from "@/lib/types";

export const metadata = { title: "Quotations" };

/** Postgres "undefined_table" / PostgREST "table not found in schema cache". */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

function Notice({ message }: { message: string }) {
  return (
    <div>
      <PageHeader title="Quotations" description="Quotes you can convert into invoices." />
      <p
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
      >
        {message}
      </p>
    </div>
  );
}

export default async function QuotationsPage() {
  const supabase = await createClient();
  const [quotationsResult, { data: clients }, { data: projects }, { data: logos }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("quotations")
        .select("*, quotation_items(*), clients(name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("name", { ascending: true }),
      supabase.from("projects").select("id, title, client_id").order("title", { ascending: true }),
      supabase.from("logo_variants").select("*"),
      supabase.from("invoices").select("id, invoice_number"),
    ]);

  if (quotationsResult.error) {
    return (
      <Notice
        message={
          MISSING_TABLE_CODES.has(quotationsResult.error.code)
            ? "Quotations are not set up yet. Run supabase/schema_quotations.sql in the Supabase SQL Editor."
            : `Quotations could not be loaded: ${quotationsResult.error.message}`
        }
      />
    );
  }

  const logoList = (logos as LogoVariant[]) ?? [];
  const logoUrl =
    logoList.find((l) => l.variant_type === "horizontal")?.url ||
    logoList.find((l) => l.variant_type === "navbar_on_light")?.url ||
    null;

  const invoiceNumbers: Record<string, string> = {};
  for (const row of invoices ?? []) {
    invoiceNumbers[String(row.id)] = String(row.invoice_number);
  }

  return (
    <QuotationsManager
      initialQuotations={(quotationsResult.data as QuotationRow[]) ?? []}
      clients={(clients as Client[]) ?? []}
      projects={(projects as Pick<Project, "id" | "title" | "client_id">[]) ?? []}
      invoiceNumbers={invoiceNumbers}
      logoUrl={logoUrl}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
