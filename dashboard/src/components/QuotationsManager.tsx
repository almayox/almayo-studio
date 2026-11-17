"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConvertModal } from "@/components/quotations/ConvertModal";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { QuotationsList } from "@/components/quotations/QuotationsList";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { EmptyState, PageHeader, SummaryCards, primaryBtnClass } from "@/components/ui/PageChrome";
import { usePagination } from "@/components/ui/Pagination";
import { nextDocNumber } from "@/lib/docNumber";
import { downloadDocumentPdf } from "@/lib/documentPdf";
import {
  NEXT_STATUSES,
  STATUS_LABELS,
  canConvert,
  effectiveStatus,
  isConverted,
  isOpen,
  toPdfSource,
  type ProjectOption,
  type QuotationRow,
} from "@/lib/quotations";
import { createClient } from "@/lib/supabase/client";
import { round2 } from "@/lib/totals";
import type { Client } from "@/lib/types";

export function QuotationsManager({
  initialQuotations,
  clients,
  projects,
  invoiceNumbers,
  logoUrl,
  today,
}: {
  initialQuotations: QuotationRow[];
  clients: Client[];
  projects: ProjectOption[];
  /** Invoice id → invoice number, to label converted quotations. */
  invoiceNumbers: Record<string, string>;
  logoUrl?: string | null;
  /** Current date as YYYY-MM-DD, used to flag quotations past their validity date. */
  today: string;
}) {
  const router = useRouter();
  /** The open form: `editing` is null for a new quotation. */
  const [form, setForm] = useState<{ editing: QuotationRow | null } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertedInvoiceNumber, setConvertedInvoiceNumber] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Shown in the form as a preview; the real number is recomputed from the
  // database at insert time.
  const nextNumber = useMemo(
    () => nextDocNumber("QUO", initialQuotations.map((q) => q.quote_number)),
    [initialQuotations],
  );

  const projectTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.title);
    return map;
  }, [projects]);

  const summary = useMemo(() => {
    let quoted = 0;
    let open = 0;
    let accepted = 0;
    let converted = 0;
    for (const q of initialQuotations) {
      quoted += Number(q.total || 0);
      const status = effectiveStatus(q, today);
      if (isOpen(status)) open += 1;
      if (status === "accepted") accepted += 1;
      if (isConverted(q)) converted += 1;
    }
    const count = initialQuotations.length;
    return {
      quoted: round2(quoted),
      open,
      accepted,
      conversionRate: count ? `${Math.round((converted / count) * 100)}%` : "—",
    };
  }, [initialQuotations, today]);

  const filteredQuotations = useMemo(() => {
    let rows = filterBySearch(initialQuotations, search, (q) =>
      [
        q.quote_number,
        q.title,
        q.client_name,
        q.clients?.name,
        q.client_email,
        q.project_id ? projectTitles.get(q.project_id) : null,
        effectiveStatus(q, today),
        q.currency,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (statusFilter !== "all") {
      rows = rows.filter((q) => effectiveStatus(q, today) === statusFilter);
    }
    return rows;
  }, [initialQuotations, search, statusFilter, projectTitles, today]);

  const pagination = usePagination(filteredQuotations, 10);

  async function updateStatus(q: QuotationRow, status: string) {
    if (isConverted(q) || !(NEXT_STATUSES[q.status] || []).includes(status)) return;
    setPageError(null);
    const supabase = createClient();
    // Only applies while the quotation is still unconverted and in the status
    // shown on screen.
    const { data: updatedRows, error: updateError } = await supabase
      .from("quotations")
      .update({ status })
      .eq("id", q.id)
      .eq("status", q.status)
      .is("converted_invoice_id", null)
      .is("converted_at", null)
      .select("id");
    if (updateError) {
      setPageError(`Status was not changed: ${updateError.message}`);
      return;
    }
    if (!updatedRows?.length) {
      setPageError(
        "Status was not changed: this quotation was updated elsewhere. The list has been reloaded.",
      );
    }
    router.refresh();
  }

  async function remove(q: QuotationRow) {
    if (isConverted(q)) return;
    if (!window.confirm(`Delete quotation ${q.quote_number}? This cannot be undone.`)) return;
    setPageError(null);
    const supabase = createClient();

    // Line items are removed with the quotation by the database (on delete
    // cascade). A converted quotation is never deleted.
    const { data: deletedRows, error: deleteError } = await supabase
      .from("quotations")
      .delete()
      .eq("id", q.id)
      .is("converted_invoice_id", null)
      .is("converted_at", null)
      .select("id");
    if (deleteError) {
      setPageError(`Quotation was not deleted: ${deleteError.message}`);
      return;
    }
    if (!deletedRows?.length) {
      setPageError(
        "Quotation was not deleted: it has been converted to an invoice or was already removed.",
      );
    }
    router.refresh();
  }

  async function downloadPdf(q: QuotationRow) {
    setPageError(null);
    setPageError(
      await downloadDocumentPdf(toPdfSource(q, effectiveStatus(q, today)), logoUrl, "quotation"),
    );
  }

  function openConvert(q: QuotationRow) {
    if (!canConvert(q)) return;
    setPageError(null);
    setConvertId(q.id);
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Quote a client, then convert the quotation into an invoice."
        action={
          <button
            type="button"
            onClick={() => setForm({ editing: null })}
            className={primaryBtnClass}
          >
            New quotation
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Total quoted", value: summary.quoted.toFixed(2), tone: "blue" },
          { label: "Open (draft + sent)", value: summary.open, tone: "yellow" },
          { label: "Accepted", value: summary.accepted, tone: "green" },
          { label: "Conversion rate", value: summary.conversionRate, tone: "slate" },
        ]}
      />

      {convertedInvoiceNumber ? (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <p>
            Invoice <span className="font-semibold">{convertedInvoiceNumber}</span> was created
            from the quotation.{" "}
            <Link href="/invoices" className="font-medium underline">
              Open invoices
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setConvertedInvoiceNumber(null)}
            aria-label="Dismiss"
            className="px-1 text-lg leading-none text-emerald-800/70 hover:text-emerald-900"
          >
            ×
          </button>
        </div>
      ) : null}

      {pageError ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search quote #, title, client, project…"
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
      />

      {filteredQuotations.length === 0 ? (
        <EmptyState
          message={
            initialQuotations.length === 0
              ? "No quotations yet. Create your first one."
              : "No quotations match your filters."
          }
        />
      ) : (
        <QuotationsList
          pagination={pagination}
          today={today}
          projectTitles={projectTitles}
          invoiceNumbers={invoiceNumbers}
          onEdit={(q) => {
            if (!isConverted(q)) setForm({ editing: q });
          }}
          onPdf={downloadPdf}
          onConvert={openConvert}
          onDelete={remove}
          onStatusChange={updateStatus}
        />
      )}

      {form ? (
        <QuotationForm
          editing={form.editing}
          clients={clients}
          projects={projects}
          nextNumber={nextNumber}
          onClose={() => setForm(null)}
        />
      ) : null}

      {convertId ? (
        <ConvertModal
          quotationId={convertId}
          quotation={initialQuotations.find((q) => q.id === convertId) || null}
          today={today}
          onClose={() => setConvertId(null)}
          onConverted={(invoiceNumber) => {
            setConvertId(null);
            setConvertedInvoiceNumber(invoiceNumber);
          }}
        />
      ) : null}
    </div>
  );
}
