"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { InvoicesList } from "@/components/invoices/InvoicesList";
import { PaymentHistoryModal, PaymentModal } from "@/components/invoices/PaymentModals";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { EmptyState, PageHeader, SummaryCards, primaryBtnClass } from "@/components/ui/PageChrome";
import { usePagination } from "@/components/ui/Pagination";
import { nextDocNumber } from "@/lib/docNumber";
import { downloadDocumentPdf } from "@/lib/documentPdf";
import {
  INVOICE_STATUS_OPTIONS,
  deleteInvoice,
  invoiceMailto,
  type InvoiceRow,
} from "@/lib/invoices";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

export function InvoicesManager({
  initialInvoices,
  clients,
  logoUrl,
}: {
  initialInvoices: InvoiceRow[];
  clients: Client[];
  logoUrl?: string | null;
}) {
  const router = useRouter();
  /** The open form: `editing` is null for a new invoice. */
  const [form, setForm] = useState<{ editing: InvoiceRow | null } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Shown in the form as a preview; the real number is recomputed from the
  // database at insert time.
  const nextNumber = useMemo(
    () => nextDocNumber("INV", initialInvoices.map((inv) => inv.invoice_number)),
    [initialInvoices],
  );

  const summary = useMemo(() => {
    let invoiced = 0;
    let collected = 0;
    let count = 0;
    for (const inv of initialInvoices) {
      if (inv.status === "cancelled") continue;
      invoiced += Number(inv.total || 0);
      collected += Number(inv.amount_paid || 0);
      count += 1;
    }
    return { invoiced, collected, outstanding: Math.max(0, invoiced - collected), count };
  }, [initialInvoices]);

  const filteredInvoices = useMemo(() => {
    let rows = filterBySearch(initialInvoices, search, (inv) =>
      [inv.invoice_number, inv.client_name, inv.client_email, inv.status, inv.currency]
        .filter(Boolean)
        .join(" "),
    );
    if (statusFilter !== "all") {
      rows = rows.filter((inv) => inv.status === statusFilter);
    }
    return rows;
  }, [initialInvoices, search, statusFilter]);

  const pagination = usePagination(filteredInvoices, 10);

  // Looked up on every render, so an open dialog follows the refreshed data.
  const findInvoice = (id: string | null) =>
    id ? initialInvoices.find((invoice) => invoice.id === id) || null : null;
  const historyInvoice = findInvoice(historyInvoiceId);

  async function updateStatus(invoice: InvoiceRow, status: string) {
    setPageError(null);
    const { error: updateError } = await createClient()
      .from("invoices")
      .update({ status })
      .eq("id", invoice.id);
    if (updateError) {
      setPageError(`Status was not changed: ${updateError.message}`);
      return;
    }
    router.refresh();
  }

  async function remove(invoice: InvoiceRow) {
    if (!window.confirm("Delete this invoice?")) return;
    setPageError(null);
    const result = await deleteInvoice(createClient(), invoice.id);
    if (result.error) setPageError(result.error);
    if (result.refresh) router.refresh();
  }

  async function downloadPdf(invoice: InvoiceRow) {
    setPageError(null);
    setPageError(await downloadDocumentPdf(invoice, logoUrl));
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Drafts, payments, PDFs, and status tracking."
        action={
          <button
            type="button"
            onClick={() => setForm({ editing: null })}
            className={primaryBtnClass}
          >
            New invoice
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Invoiced", value: summary.invoiced.toFixed(2), tone: "blue" },
          { label: "Collected", value: summary.collected.toFixed(2), tone: "green" },
          {
            label: "Outstanding",
            value: summary.outstanding.toFixed(2),
            tone: summary.outstanding > 0 ? "yellow" : "green",
          },
          { label: "Invoices", value: summary.count, tone: "slate" },
        ]}
      />

      {pageError ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {pageError}
        </p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice #, client, email…"
        status={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={INVOICE_STATUS_OPTIONS}
      />

      {filteredInvoices.length === 0 ? (
        <EmptyState
          message={
            initialInvoices.length === 0
              ? "No invoices yet. Create your first draft."
              : "No invoices match your filters."
          }
        />
      ) : (
        <InvoicesList
          pagination={pagination}
          onEdit={(invoice) => setForm({ editing: invoice })}
          onPdf={downloadPdf}
          onEmail={(invoice) => {
            window.location.href = invoiceMailto(invoice);
          }}
          onPayment={(invoice) => setPaymentInvoiceId(invoice.id)}
          onHistory={(invoice) => setHistoryInvoiceId(invoice.id)}
          onDelete={remove}
          onStatusChange={updateStatus}
        />
      )}

      {form ? (
        <InvoiceForm
          editing={form.editing}
          clients={clients}
          nextNumber={nextNumber}
          onClose={() => setForm(null)}
        />
      ) : null}

      {paymentInvoiceId ? (
        <PaymentModal
          invoiceId={paymentInvoiceId}
          invoice={findInvoice(paymentInvoiceId)}
          onClose={() => setPaymentInvoiceId(null)}
          onSaved={(problems) => {
            setPaymentInvoiceId(null);
            setPageError(problems);
            router.refresh();
          }}
        />
      ) : null}

      {historyInvoice ? (
        <PaymentHistoryModal invoice={historyInvoice} onClose={() => setHistoryInvoiceId(null)} />
      ) : null}
    </div>
  );
}
