"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import {
  EmptyState,
  PageHeader,
  SummaryCards,
  fieldClass,
  inlineSelectClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
  ActionGroup,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { FileText, History, Mail, Pencil, Trash2, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadInvoicePdf, PdfUnsupportedTextError } from "@/lib/invoicePdf";
import { resolveStorageUrl } from "@/lib/storage";
import { insertWithNextNumber, nextDocNumber } from "@/lib/docNumber";
import { computeTotals, lineAmount, round2, type DiscountMode } from "@/lib/totals";
import type { Client, Invoice, InvoiceItem, InvoicePayment, InvoicePaymentEvent } from "@/lib/types";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "knet", label: "KNET / online" },
  { value: "credit_card", label: "Credit card" },
  { value: "paypal", label: "PayPal" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

/** Status value this codebase uses for an invoice that is partly paid. */
const PARTIAL_STATUS = "partial";
const FOREIGN_KEY_VIOLATION = "23503";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type LineDraft = { description: string; quantity: string; unit_price: string };
type InvoiceRow = Invoice & {
  invoice_items?: InvoiceItem[];
  invoice_payments?: InvoicePayment[];
  invoice_payment_events?: InvoicePaymentEvent[];
};

const emptyLine = (): LineDraft => ({
  description: "",
  quantity: "1",
  unit_price: "",
});

function methodLabel(method: string | null) {
  if (!method) return "";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
}

/** Next invoice number (INV-<year>-NNN); see nextDocNumber. */
function nextInvoiceNumber(existing: string[]) {
  return nextDocNumber("INV", existing);
}

/** Line drafts → rows as they are stored (2-decimal precision, like the database). */
function toLineItems(lines: LineDraft[]) {
  return lines.map((line, index) => {
    const quantity = Number(line.quantity) > 0 ? round2(Number(line.quantity)) : 1;
    const unit_price = round2(Number(line.unit_price) || 0);
    return {
      description: line.description.trim(),
      quantity,
      unit_price,
      amount: lineAmount({ quantity, unit_price }),
      sort_order: index,
    };
  });
}

/** Status implied by the payments received; keeps the current one when nothing is paid. */
function statusForPayments(current: string, paid: number, total: number) {
  if (paid <= 0) {
    return current === "paid" || current === PARTIAL_STATUS ? "sent" : current;
  }
  return paid >= total ? "paid" : PARTIAL_STATUS;
}

function invoiceBalance(invoice: Pick<Invoice, "total" | "amount_paid">) {
  const total = Number(invoice.total) || 0;
  const paid = Number(invoice.amount_paid || 0);
  return { total, paid, balance: Math.max(0, round2(total - paid)) };
}

/**
 * Re-reads every payment of the invoice and writes amount_paid (their sum)
 * and the matching status. Returns an error message, or null on success.
 */
async function syncInvoicePayments(
  supabase: SupabaseBrowserClient,
  invoiceId: string,
): Promise<string | null> {
  const { data: payments, error: paymentsError } = await supabase
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoiceId);
  if (paymentsError) return paymentsError.message;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .single();
  if (invoiceError) return invoiceError.message;

  const paid = round2(
    (payments || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: paid,
      status: statusForPayments(String(invoice.status), paid, Number(invoice.total) || 0),
    })
    .eq("id", invoiceId);
  return updateError ? updateError.message : null;
}

function BalanceSummary({ invoice }: { invoice: InvoiceRow }) {
  const { total, paid, balance } = invoiceBalance(invoice);
  const cells = [
    { label: "Total", value: total, tone: "text-navy" },
    { label: "Paid so far", value: paid, tone: "text-emerald-700" },
    { label: "Balance due", value: balance, tone: balance > 0 ? "text-amber-700" : "text-emerald-700" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-xl border border-mist bg-foam/50 p-3">
      {cells.map((cell) => (
        <div key={cell.label}>
          <dt className="text-xs text-navy/55">{cell.label}</dt>
          <dd className={`text-sm font-semibold tabular-nums ${cell.tone}`}>
            {cell.value.toFixed(2)} {invoice.currency}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taxPercent, setTaxPercent] = useState("");
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Shown in the form as a preview; the real number is recomputed from the
  // database at insert time.
  const nextNumber = useMemo(
    () => nextInvoiceNumber(initialInvoices.map((inv) => inv.invoice_number)),
    [initialInvoices],
  );

  // Single source for both the preview and what gets saved.
  const draft = useMemo(() => {
    const items = toLineItems(lines);
    const totals = computeTotals({
      lines: items,
      discountMode,
      discountValue: discountMode === "percent" ? discountPercent : discountAmount,
      taxPercent,
    });
    return { items, totals };
  }, [lines, discountPercent, discountAmount, discountMode, taxPercent]);
  const draftMath = draft.totals;

  const summary = useMemo(() => {
    let invoiced = 0;
    let collected = 0;
    for (const inv of initialInvoices) {
      if (inv.status === "cancelled") continue;
      invoiced += Number(inv.total || 0);
      collected += Number(inv.amount_paid || 0);
    }
    return { invoiced, collected, outstanding: Math.max(0, invoiced - collected) };
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

  function resetForm() {
    setEditingId(null);
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setClientId("");
    setCurrency("KWD");
    setDueDate("");
    setNotes("");
    setDiscountPercent("");
    setDiscountAmount("");
    setDiscountMode("percent");
    setTaxPercent("");
    setTaxLabel("Tax");
    setLines([emptyLine()]);
    setError(null);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  function startCreate() {
    resetForm();
    setFormOpen(true);
  }

  function startEdit(invoice: InvoiceRow) {
    setEditingId(invoice.id);
    setClientName(invoice.client_name);
    setClientEmail(invoice.client_email || "");
    setClientAddress(invoice.client_address || "");
    setClientId(invoice.client_id || "");
    setCurrency(invoice.currency || "KWD");
    setDueDate(invoice.due_date || "");
    setNotes(invoice.notes || "");
    setDiscountPercent(
      invoice.discount_percent != null ? String(invoice.discount_percent) : "",
    );
    if (Number(invoice.discount_amount) > 0) {
      setDiscountMode("amount");
      setDiscountAmount(String(invoice.discount_amount));
    } else {
      setDiscountMode("percent");
      setDiscountAmount("");
    }
    setTaxPercent(invoice.tax_percent != null ? String(invoice.tax_percent) : "");
    setTaxLabel(invoice.tax_label || "Tax");
    const items = (invoice.invoice_items || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    setLines(
      items.length
        ? items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit_price: String(item.unit_price),
          }))
        : [emptyLine()],
    );
    setError(null);
    setFormOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const stop = (message: string) => {
      setError(message);
      setSaving(false);
    };

    // Exactly what the preview shows.
    const { items, totals } = draft;
    if (!items.length) return stop("Add at least one line item.");
    if (items.some((item) => !item.description)) {
      return stop("Every line item needs a description.");
    }
    if (items.some((item) => item.unit_price < 0)) {
      return stop("Unit price cannot be negative.");
    }

    const supabase = createClient();

    const invoicePayload = {
      client_name: clientName,
      client_email: clientEmail || null,
      client_address: clientAddress || null,
      client_id: clientId || null,
      currency,
      subtotal: totals.subtotal,
      discount_percent:
        discountMode === "percent" && discountPercent !== ""
          ? Number(discountPercent)
          : null,
      discount_amount:
        discountMode === "amount" && discountAmount !== ""
          ? round2(Number(discountAmount))
          : null,
      tax_percent: taxPercent === "" ? null : Number(taxPercent),
      tax_label: taxLabel || null,
      total: totals.total,
      due_date: dueDate || null,
      notes: notes || null,
    };

    if (editingId) {
      const existing = initialInvoices.find((i) => i.id === editingId);
      const amountPaid = Number(existing?.amount_paid || 0);
      const status = statusForPayments(existing?.status || "draft", amountPaid, totals.total);

      // 1. Remember which item rows exist now. They are only deleted once
      //    their replacements are safely stored.
      const { data: oldItems, error: oldItemsError } = await supabase
        .from("invoice_items")
        .select("id")
        .eq("invoice_id", editingId);
      if (oldItemsError) return stop(oldItemsError.message);
      const oldItemIds = (oldItems || []).map((row) => row.id as string);

      // 2. Insert the new items.
      const { data: newItems, error: itemError } = await supabase
        .from("invoice_items")
        .insert(items.map((line) => ({ ...line, invoice_id: editingId })))
        .select("id");
      if (itemError) return stop(`Line items were not saved: ${itemError.message}`);
      const newItemIds = (newItems || []).map((row) => row.id as string);

      // 3. Update the invoice; undo the inserted items if that fails.
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ ...invoicePayload, status })
        .eq("id", editingId);
      if (updateError) {
        const { error: undoError } = newItemIds.length
          ? await supabase.from("invoice_items").delete().in("id", newItemIds)
          : { error: null };
        return stop(
          undoError
            ? `${updateError.message}. The new line items could not be rolled back (${undoError.message}); reload before editing again.`
            : updateError.message,
        );
      }

      // 4. Only now remove the previous items, by id.
      if (oldItemIds.length) {
        const { error: deleteError } = await supabase
          .from("invoice_items")
          .delete()
          .in("id", oldItemIds);
        if (deleteError) {
          router.refresh();
          return stop(
            `Invoice saved, but the previous line items could not be removed: ${deleteError.message}. Save again to retry.`,
          );
        }
      }
    } else {
      // A duplicate number (someone else created an invoice meanwhile) is
      // retried once with a freshly computed number.
      const created = await insertWithNextNumber(supabase, {
        table: "invoices",
        numberColumn: "invoice_number",
        prefix: "INV",
        values: { ...invoicePayload, status: "draft", amount_paid: 0 },
      });
      if (!created.ok) {
        return stop(
          created.duplicate
            ? "That invoice number was just taken. Please try again."
            : created.message,
        );
      }
      const invoiceId = created.id;

      const { error: itemError } = await supabase
        .from("invoice_items")
        .insert(items.map((line) => ({ ...line, invoice_id: invoiceId })));
      if (itemError) {
        // Do not leave an invoice without lines behind.
        const { error: undoError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId);
        if (undoError) router.refresh();
        return stop(
          undoError
            ? `Line items were not saved: ${itemError.message}. An empty invoice was left behind; delete it from the list.`
            : `Line items were not saved, so the invoice was not created: ${itemError.message}`,
        );
      }
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    setPageError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", id);
    if (updateError) {
      setPageError(`Status was not changed: ${updateError.message}`);
      return;
    }
    router.refresh();
  }

  function openPayment(invoice: InvoiceRow) {
    setPaymentError(null);
    setPaymentNotes("");
    setPaymentAmount(invoiceBalance(invoice).balance.toFixed(2));
    setPaymentInvoiceId(invoice.id);
  }

  function closePayment() {
    setPaymentInvoiceId(null);
    setPaymentError(null);
  }

  function openHistory(invoice: InvoiceRow) {
    setPaymentError(null);
    setHistoryInvoiceId(invoice.id);
  }

  function closeHistory() {
    setHistoryInvoiceId(null);
    setPaymentError(null);
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!paymentInvoiceId || paymentSaving) return;
    const invoiceId = paymentInvoiceId;
    setPaymentError(null);

    const amount = round2(Number(paymentAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Payment amount must be greater than 0.");
      return;
    }
    if (!paymentDate) {
      setPaymentError("Choose the payment date.");
      return;
    }

    setPaymentSaving(true);
    const supabase = createClient();
    try {
      // Validate against what is in the database right now, not the page data.
      const [invoiceResult, paymentsResult] = await Promise.all([
        supabase.from("invoices").select("total, currency").eq("id", invoiceId).single(),
        supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId),
      ]);
      if (invoiceResult.error || paymentsResult.error) {
        setPaymentError(
          (invoiceResult.error || paymentsResult.error)?.message ||
            "Could not load the invoice.",
        );
        return;
      }
      const invoiceCurrency = String(invoiceResult.data.currency);
      const paidSoFar = round2(
        (paymentsResult.data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      );
      const remaining = round2((Number(invoiceResult.data.total) || 0) - paidSoFar);
      if (remaining <= 0) {
        setPaymentError("This invoice is already paid in full.");
        return;
      }
      if (amount > remaining) {
        setPaymentError(
          `Payment cannot be more than the balance due (${remaining.toFixed(2)} ${invoiceCurrency}).`,
        );
        return;
      }

      const { data: payment, error: payError } = await supabase
        .from("invoice_payments")
        .insert({
          invoice_id: invoiceId,
          amount,
          currency: invoiceCurrency,
          payment_date: paymentDate,
          method: paymentMethod,
          notes: paymentNotes || null,
        })
        .select("id")
        .single();
      if (payError) {
        setPaymentError(payError.message);
        return;
      }

      // The payment exists from here on: finish the bookkeeping and report
      // anything that failed instead of leaving the form open for a re-submit.
      const problems: string[] = [];
      const syncError = await syncInvoicePayments(supabase, invoiceId);
      if (syncError) problems.push(`the invoice paid amount/status was not updated (${syncError})`);

      const { error: eventError } = await supabase.from("invoice_payment_events").insert({
        invoice_id: invoiceId,
        action: "added",
        amount,
        currency: invoiceCurrency,
        payment_date: paymentDate,
        method: paymentMethod,
        notes: paymentNotes || null,
        payment_id: payment?.id ?? null,
      });
      if (eventError) problems.push(`the activity log entry was not written (${eventError.message})`);

      setPaymentInvoiceId(null);
      setPaymentAmount("");
      setPaymentNotes("");
      setPageError(problems.length ? `Payment saved, but ${problems.join(" and ")}.` : null);
      router.refresh();
    } finally {
      setPaymentSaving(false);
    }
  }

  async function removePayment(payment: InvoicePayment, invoice: InvoiceRow) {
    if (!window.confirm("Delete this payment?")) return;
    setPaymentError(null);
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("invoice_payments")
      .delete()
      .eq("id", payment.id);
    if (deleteError) {
      setPaymentError(`Payment was not deleted: ${deleteError.message}`);
      return;
    }

    const problems: string[] = [];
    const syncError = await syncInvoicePayments(supabase, invoice.id);
    if (syncError) problems.push(`the invoice paid amount/status was not updated (${syncError})`);

    const { error: eventError } = await supabase.from("invoice_payment_events").insert({
      invoice_id: invoice.id,
      action: "deleted",
      amount: payment.amount,
      currency: payment.currency,
      payment_date: payment.payment_date,
      method: payment.method,
      notes: payment.notes,
      payment_id: payment.id,
    });
    if (eventError) problems.push(`the activity log entry was not written (${eventError.message})`);

    if (problems.length) setPaymentError(`Payment deleted, but ${problems.join(" and ")}.`);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this invoice?")) return;
    setPageError(null);
    const supabase = createClient();

    // Items, payments and events are removed with the invoice by the
    // database (on delete cascade), so this is a single all-or-nothing delete.
    let { error: deleteError } = await supabase.from("invoices").delete().eq("id", id);

    if (deleteError?.code === FOREIGN_KEY_VIOLATION) {
      // Database without the cascade rules: remove the child rows first.
      for (const table of ["invoice_payment_events", "invoice_payments", "invoice_items"]) {
        const { error: childError } = await supabase.from(table).delete().eq("invoice_id", id);
        if (childError) {
          setPageError(`Invoice was not deleted: ${childError.message}`);
          router.refresh();
          return;
        }
      }
      ({ error: deleteError } = await supabase.from("invoices").delete().eq("id", id));
    }

    if (deleteError) {
      setPageError(`Invoice was not deleted: ${deleteError.message}`);
      return;
    }
    router.refresh();
  }

  async function downloadPdf(invoice: InvoiceRow) {
    setPageError(null);
    try {
      // The logo may live in a private bucket: sign it first. A logo that
      // cannot be signed or loaded is simply left out of the PDF.
      let signedLogoUrl: string | null = null;
      try {
        signedLogoUrl = await resolveStorageUrl(logoUrl);
      } catch {
        signedLogoUrl = null;
      }
      await downloadInvoicePdf(invoice, signedLogoUrl);
    } catch (err) {
      setPageError(
        err instanceof PdfUnsupportedTextError
          ? "This PDF font cannot render Arabic text yet"
          : `Could not generate the PDF${err instanceof Error && err.message ? `: ${err.message}` : "."}`,
      );
    }
  }

  function emailInvoice(invoice: InvoiceRow) {
    const items = (invoice.invoice_items || [])
      .map(
        (item) =>
          `- ${item.description}: ${item.quantity} x ${item.unit_price} = ${item.amount} ${invoice.currency}`,
      )
      .join("\n");
    const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
    const body = encodeURIComponent(
      `Hello ${invoice.client_name},\n\nPlease find your invoice details:\n\nInvoice: ${invoice.invoice_number}\nTotal: ${Number(invoice.total).toFixed(2)} ${invoice.currency}\nDue: ${invoice.due_date || "N/A"}\n\nItems:\n${items}\n\nThank you,\nAlmayo Studio`,
    );
    window.location.href = `mailto:${invoice.client_email || ""}?subject=${subject}&body=${body}`;
  }

  const historyInvoice = historyInvoiceId
    ? initialInvoices.find((i) => i.id === historyInvoiceId) || null
    : null;
  const paymentInvoice = paymentInvoiceId
    ? initialInvoices.find((i) => i.id === paymentInvoiceId) || null
    : null;
  const historyPayments = (historyInvoice?.invoice_payments || [])
    .slice()
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const historyEvents = (historyInvoice?.invoice_payment_events || [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Drafts, payments, PDFs, and status tracking."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            New invoice
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Invoiced", value: summary.invoiced.toFixed(2), tone: "blue" },
          { label: "Collected", value: summary.collected.toFixed(2), tone: "green" },
          { label: "Outstanding", value: summary.outstanding.toFixed(2), tone: summary.outstanding > 0 ? "yellow" : "green" },
          { label: "Invoices", value: initialInvoices.filter((i) => i.status !== "cancelled").length, tone: "slate" },
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
        statusOptions={[
          { value: "draft", label: "Draft" },
          { value: "sent", label: "Sent" },
          { value: "partial", label: "Partial" },
          { value: "paid", label: "Paid" },
          { value: "overdue", label: "Overdue" },
          { value: "cancelled", label: "Cancelled" },
        ]}
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
        <>
          <div className="overflow-hidden rounded-2xl border border-mist bg-white md:hidden">
            <div className="space-y-3 p-4">
            {pagination.pageItems.map((invoice) => (
              <article
                key={invoice.id}
                className="rounded-2xl border border-mist bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">{invoice.invoice_number}</p>
                    <p className="text-xs text-navy/55">{invoice.client_name}</p>
                    {invoice.quotation_id ? (
                      <p className="text-xs text-navy/45">From quotation</p>
                    ) : null}
                  </div>
                  <select
                    value={invoice.status}
                    onChange={(e) => updateStatus(invoice.id, e.target.value)}
                    className={inlineSelectClass}
                  >
                    {["draft", "sent", "partial", "paid", "overdue", "cancelled"].map(
                      (status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <p className="mt-2 text-sm text-navy">
                  {Number(invoice.total).toFixed(2)} {invoice.currency}
                  <span className="text-navy/50">
                    {" "}
                    · paid {Number(invoice.amount_paid || 0).toFixed(2)}
                  </span>
                </p>
                <div className="mt-3">
                  <ActionGroup>
                    <ActionButton
                      icon={Pencil}
                      label="Edit"
                      onClick={() => startEdit(invoice)}
                    />
                    <ActionButton
                      icon={FileText}
                      label="PDF"
                      onClick={() => downloadPdf(invoice)}
                    />
                    <ActionButton
                      icon={Mail}
                      label="Email"
                      onClick={() => emailInvoice(invoice)}
                    />
                    <ActionButton
                      icon={Wallet}
                      label="Payment"
                      onClick={() => openPayment(invoice)}
                    />
                    <ActionButton
                      icon={History}
                      label="History"
                      onClick={() => openHistory(invoice)}
                    />
                    <ActionButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => remove(invoice.id)}
                    />
                  </ActionGroup>
                </div>
              </article>
            ))}
            </div>
            <PaginationBar
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              onPageChange={pagination.goTo}
              onPageSizeChange={pagination.changePageSize}
            />
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-mist bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-mist bg-foam text-xs uppercase tracking-wide text-navy/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Total / Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {pagination.pageItems.map((invoice) => (
                  <tr key={invoice.id} className="align-top hover:bg-foam/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{invoice.invoice_number}</p>
                      <p className="text-xs text-navy/55">{invoice.client_name}</p>
                      <p className="mt-1 text-xs text-navy/45">
                        {invoice.quotation_id ? "From quotation · " : ""}
                        {(invoice.invoice_items || []).length} lines ·{" "}
                        {(invoice.invoice_payments || []).length} payments
                      </p>
                    </td>
                    <td className="px-4 py-3 text-navy/80">
                      <p>
                        {Number(invoice.total).toFixed(2)} {invoice.currency}
                      </p>
                      <p className="text-xs text-navy/50">
                        Paid {Number(invoice.amount_paid || 0).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={invoice.status}
                        onChange={(e) => updateStatus(invoice.id, e.target.value)}
                        className={inlineSelectClass}
                      >
                        {["draft", "sent", "partial", "paid", "overdue", "cancelled"].map(
                          (status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <ActionGroup>
                        <ActionButton
                          icon={Pencil}
                          label="Edit"
                          onClick={() => startEdit(invoice)}
                        />
                        <ActionButton
                          icon={FileText}
                          label="PDF"
                          onClick={() => downloadPdf(invoice)}
                        />
                        <ActionButton
                          icon={Mail}
                          label="Email"
                          onClick={() => emailInvoice(invoice)}
                        />
                        <ActionButton
                          icon={Wallet}
                          label="Payment"
                          onClick={() => openPayment(invoice)}
                        />
                        <ActionButton
                          icon={History}
                          label="History"
                          onClick={() => openHistory(invoice)}
                        />
                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          danger
                          onClick={() => remove(invoice.id)}
                        />
                      </ActionGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              onPageChange={pagination.goTo}
              onPageSizeChange={pagination.changePageSize}
            />
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? "Edit invoice" : "New invoice"}
        description={editingId ? "Update client, lines, tax & discount." : `Number: ${nextNumber}`}
        wide
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Existing client
            <SearchSelect
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                const selected = clients.find((c) => c.id === id);
                if (selected) {
                  setClientName(selected.name);
                  setClientEmail(selected.email || "");
                  setClientAddress(selected.address || "");
                }
              }}
              placeholder="Search clients…"
              emptyLabel="Manual client"
              options={clients.map((client) => ({
                value: client.id,
                label: client.name,
              }))}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Client name
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Client email
              <input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Client address
            <textarea
              rows={2}
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className={fieldClass}
            />
          </label>

          <div className="space-y-2 rounded-xl border border-mist bg-foam/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-navy/50">
                Line items
              </p>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="text-xs font-medium text-navy underline"
              >
                + Add line
              </button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="space-y-2 rounded-lg bg-white p-2 ring-1 ring-mist">
                <input
                  required
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index ? { ...l, description: e.target.value } : l,
                      ),
                    )
                  }
                  className="w-full rounded-lg border border-mist bg-foam px-3 py-2 text-sm outline-none"
                />
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, quantity: e.target.value } : l,
                        ),
                      )
                    }
                    className="rounded-lg border border-mist bg-foam px-3 py-2 text-sm outline-none"
                    placeholder="Qty"
                  />
                  <input
                    required
                    type="number"
                    step="0.001"
                    value={line.unit_price}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === index ? { ...l, unit_price: e.target.value } : l,
                        ),
                      )
                    }
                    className="rounded-lg border border-mist bg-foam px-3 py-2 text-sm outline-none"
                    placeholder="Price"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLines((prev) =>
                        prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== index),
                      )
                    }
                    className="px-2 text-xs text-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <div className="space-y-0.5 text-sm text-navy">
              <p>Subtotal: {draftMath.subtotal.toFixed(2)} {currency}</p>
              {draftMath.discount > 0 ? (
                <p className="text-navy/60">
                  Discount: −{draftMath.discount.toFixed(2)}
                </p>
              ) : null}
              {Number(taxPercent) > 0 ? (
                <p className="text-navy/60">
                  {taxLabel || "Tax"}: {draftMath.tax.toFixed(2)}
                </p>
              ) : null}
              <p className="font-semibold">
                Total: {draftMath.total.toFixed(2)} {currency}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={`${labelClass} col-span-2 sm:col-span-4`}>
              Discount type
              <select
                value={discountMode}
                onChange={(e) =>
                  setDiscountMode(e.target.value as "percent" | "amount")
                }
                className={fieldClass}
              >
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed amount</option>
              </select>
            </label>
            {discountMode === "percent" ? (
              <label className={labelClass}>
                Discount %
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ) : (
              <label className={labelClass}>
                Discount amount
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className={fieldClass}
                />
              </label>
            )}
            <label className={labelClass}>
              Tax %
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Tax label
              <input
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={fieldClass}
              >
                {["KWD", "USD", "EUR", "ETB", "PLN"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelClass}>
            Due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Notes
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={closeForm} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save invoice" : "Create invoice"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(paymentInvoiceId)}
        onClose={closePayment}
        title="Record payment"
        description={
          paymentInvoice
            ? `${paymentInvoice.invoice_number} · part payments are allowed until the invoice is paid in full.`
            : undefined
        }
      >
        <form onSubmit={recordPayment} className="space-y-3">
          {paymentInvoice ? <BalanceSummary invoice={paymentInvoice} /> : null}
          <label className={labelClass}>
            Amount
            <input
              required
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Method
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={fieldClass}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Date
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Notes
            <input
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className={fieldClass}
            />
          </label>
          {paymentError ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {paymentError}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closePayment}
              className={`flex-1 ${secondaryBtnClass}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paymentSaving}
              className={`flex-1 ${primaryBtnClass}`}
            >
              {paymentSaving ? "Saving…" : "Save payment"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(historyInvoice)}
        onClose={closeHistory}
        title={
          historyInvoice
            ? `Payments · ${historyInvoice.invoice_number}`
            : "Payments"
        }
      >
        {historyInvoice ? <BalanceSummary invoice={historyInvoice} /> : null}
        {paymentError ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {paymentError}
          </p>
        ) : null}

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/45">
            Payments ({historyPayments.length})
          </p>
          {historyPayments.length === 0 ? (
            <p className="text-sm text-navy/55">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-mist">
              {historyPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-navy">
                      {Number(payment.amount).toFixed(2)} {payment.currency}
                    </p>
                    <p className="text-xs text-navy/55">
                      {payment.payment_date}
                      {payment.method ? ` · ${methodLabel(payment.method)}` : ""}
                    </p>
                    {payment.notes ? (
                      <p className="mt-1 text-xs text-navy/45">{payment.notes}</p>
                    ) : null}
                  </div>
                  {historyInvoice ? (
                    <ActionButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => removePayment(payment, historyInvoice)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {historyEvents.length ? (
          <div className="mt-4 border-t border-mist pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/45">
              Activity log
            </p>
            <ul className="divide-y divide-mist">
              {historyEvents.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p
                      className={`font-medium ${
                        event.action === "deleted" ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {event.action === "added" ? "Payment added" : "Payment removed"} ·{" "}
                      {Number(event.amount).toFixed(2)} {event.currency}
                    </p>
                    <p className="text-xs text-navy/55">
                      {event.payment_date || "-"}
                      {event.method ? ` · ${methodLabel(event.method)}` : ""}
                      {" · "}
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {event.notes ? (
                      <p className="mt-1 text-xs text-navy/45">{event.notes}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
