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
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import {
  Copy,
  Eye,
  EyeOff,
  FileText,
  History,
  Mail,
  Pencil,
  Settings2,
  Trash2,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
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

function computeTotals(
  lines: { quantity: number; unit_price: number }[],
  discountPercent: number,
  discountAmount: number,
  taxPercent: number,
) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discount =
    discountAmount > 0 ? discountAmount : subtotal * (discountPercent / 100);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (taxPercent / 100);
  return { subtotal, discount, tax, total: taxable + tax };
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
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
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
  const [historyInvoiceId, setHistoryInvoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nextNumber = useMemo(() => {
    const year = new Date().getFullYear();
    return `INV-${year}-${String(initialInvoices.length + 1).padStart(3, "0")}`;
  }, [initialInvoices.length]);

  const draftMath = useMemo(() => {
    const parsed = lines.map((line) => ({
      quantity: Number(line.quantity) || 0,
      unit_price: Number(line.unit_price) || 0,
    }));
    return computeTotals(
      parsed,
      Number(discountPercent) || 0,
      discountMode === "amount" ? Number(discountAmount) || 0 : 0,
      Number(taxPercent) || 0,
    );
  }, [lines, discountPercent, discountAmount, discountMode, taxPercent]);

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
    const validLines = lines.filter((l) => l.description && Number(l.unit_price) >= 0);
    if (!validLines.length) {
      setError("Add at least one line item.");
      setSaving(false);
      return;
    }

    const computed = validLines.map((line, index) => {
      const qty = Number(line.quantity) || 1;
      const price = Number(line.unit_price) || 0;
      return {
        description: line.description,
        quantity: qty,
        unit_price: price,
        amount: qty * price,
        sort_order: index,
      };
    });
    const { subtotal, total } = computeTotals(
      computed,
      discountMode === "percent" ? Number(discountPercent) || 0 : 0,
      discountMode === "amount" ? Number(discountAmount) || 0 : 0,
      Number(taxPercent) || 0,
    );
    const supabase = createClient();

    const invoicePayload = {
      client_name: clientName,
      client_email: clientEmail || null,
      client_address: clientAddress || null,
      client_id: clientId || null,
      currency,
      subtotal,
      discount_percent:
        discountMode === "percent" && discountPercent !== ""
          ? Number(discountPercent)
          : null,
      discount_amount:
        discountMode === "amount" && discountAmount !== ""
          ? Number(discountAmount)
          : null,
      tax_percent: taxPercent === "" ? null : Number(taxPercent),
      tax_label: taxLabel || null,
      total,
      due_date: dueDate || null,
      notes: notes || null,
    };

    if (editingId) {
      const existing = initialInvoices.find((i) => i.id === editingId);
      const amountPaid = Number(existing?.amount_paid || 0);
      let status = existing?.status || "draft";
      if (amountPaid >= total && total > 0) status = "paid";
      else if (amountPaid > 0 && amountPaid < total) status = "partial";

      const { error: updateError } = await supabase
        .from("invoices")
        .update({ ...invoicePayload, status, amount_paid: amountPaid })
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      await supabase.from("invoice_items").delete().eq("invoice_id", editingId);
      const { error: itemError } = await supabase.from("invoice_items").insert(
        computed.map((line) => ({ ...line, invoice_id: editingId })),
      );
      if (itemError) {
        setError(itemError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          ...invoicePayload,
          invoice_number: nextNumber,
          status: "draft",
          amount_paid: 0,
        })
        .select("id")
        .single();

      if (invoiceError) {
        setError(invoiceError.message);
        setSaving(false);
        return;
      }

      const { error: itemError } = await supabase.from("invoice_items").insert(
        computed.map((line) => ({ ...line, invoice_id: invoice.id })),
      );
      if (itemError) {
        setError(itemError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createClient();
    await supabase.from("invoices").update({ status }).eq("id", id);
    router.refresh();
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!paymentInvoiceId) return;
    setError(null);
    const invoice = initialInvoices.find((i) => i.id === paymentInvoiceId);
    if (!invoice) return;
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    const supabase = createClient();
    const { data: payment, error: payError } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: paymentInvoiceId,
        amount,
        currency: invoice.currency,
        payment_date: paymentDate,
        method: paymentMethod,
        notes: paymentNotes || null,
      })
      .select("id")
      .single();
    if (payError) {
      setError(payError.message);
      return;
    }

    await supabase.from("invoice_payment_events").insert({
      invoice_id: paymentInvoiceId,
      action: "added",
      amount,
      currency: invoice.currency,
      payment_date: paymentDate,
      method: paymentMethod,
      notes: paymentNotes || null,
      payment_id: payment?.id ?? null,
    });

    const nextPaid = Number(invoice.amount_paid || 0) + amount;
    const nextStatus =
      nextPaid >= Number(invoice.total)
        ? "paid"
        : nextPaid > 0
          ? "partial"
          : invoice.status;
    await supabase
      .from("invoices")
      .update({ amount_paid: nextPaid, status: nextStatus })
      .eq("id", paymentInvoiceId);

    setPaymentInvoiceId(null);
    setPaymentAmount("");
    setPaymentNotes("");
    router.refresh();
  }

  async function removePayment(payment: InvoicePayment, invoice: InvoiceRow) {
    if (!window.confirm("Delete this payment?")) return;
    const supabase = createClient();

    await supabase.from("invoice_payment_events").insert({
      invoice_id: invoice.id,
      action: "deleted",
      amount: payment.amount,
      currency: payment.currency,
      payment_date: payment.payment_date,
      method: payment.method,
      notes: payment.notes,
      payment_id: payment.id,
    });

    await supabase.from("invoice_payments").delete().eq("id", payment.id);
    const nextPaid = Math.max(0, Number(invoice.amount_paid || 0) - Number(payment.amount));
    const nextStatus =
      nextPaid >= Number(invoice.total)
        ? "paid"
        : nextPaid > 0
          ? "partial"
          : invoice.status === "paid" || invoice.status === "partial"
            ? "sent"
            : invoice.status;
    await supabase
      .from("invoices")
      .update({ amount_paid: nextPaid, status: nextStatus })
      .eq("id", invoice.id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this invoice?")) return;
    const supabase = createClient();
    await supabase.from("invoice_payments").delete().eq("invoice_id", id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    await supabase.from("invoices").delete().eq("id", id);
    router.refresh();
  }

  function emailInvoice(invoice: InvoiceRow) {
    const items = (invoice.invoice_items || [])
      .map(
        (item) =>
          `- ${item.description}: ${item.quantity} x ${item.unit_price} = ${item.amount} ${invoice.currency}`,
      )
      .join("%0A");
    const subject = encodeURIComponent(`Invoice ${invoice.invoice_number}`);
    const body = encodeURIComponent(
      `Hello ${invoice.client_name},\n\nPlease find your invoice details:\n\nInvoice: ${invoice.invoice_number}\nTotal: ${Number(invoice.total).toFixed(2)} ${invoice.currency}\nDue: ${invoice.due_date || "N/A"}\n\nItems:\n${decodeURIComponent(items)}\n\nThank you,\nAlmayo Studio`,
    );
    window.location.href = `mailto:${invoice.client_email || ""}?subject=${subject}&body=${body}`;
  }

  const historyInvoice = historyInvoiceId
    ? initialInvoices.find((i) => i.id === historyInvoiceId) || null
    : null;

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
                      onClick={() => downloadInvoicePdf(invoice, logoUrl)}
                    />
                    <ActionButton
                      icon={Mail}
                      label="Email"
                      onClick={() => emailInvoice(invoice)}
                    />
                    <ActionButton
                      icon={Wallet}
                      label="Payment"
                      onClick={() => {
                        setPaymentInvoiceId(invoice.id);
                        setPaymentAmount(
                          String(
                            Math.max(
                              0,
                              Number(invoice.total) - Number(invoice.amount_paid || 0),
                            ).toFixed(3),
                          ),
                        );
                      }}
                    />
                    <ActionButton
                      icon={History}
                      label="History"
                      onClick={() => setHistoryInvoiceId(invoice.id)}
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
                          onClick={() => downloadInvoicePdf(invoice, logoUrl)}
                        />
                        <ActionButton
                          icon={Mail}
                          label="Email"
                          onClick={() => emailInvoice(invoice)}
                        />
                        <ActionButton
                          icon={Wallet}
                          label="Payment"
                          onClick={() => {
                            setPaymentInvoiceId(invoice.id);
                            setPaymentAmount(
                              String(
                                Math.max(
                                  0,
                                  Number(invoice.total) - Number(invoice.amount_paid || 0),
                                ).toFixed(3),
                              ),
                            );
                          }}
                        />
                        <ActionButton
                          icon={History}
                          label="History"
                          onClick={() => setHistoryInvoiceId(invoice.id)}
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
            <select
              value={clientId}
              onChange={(e) => {
                const id = e.target.value;
                setClientId(id);
                const selected = clients.find((c) => c.id === id);
                if (selected) {
                  setClientName(selected.name);
                  setClientEmail(selected.email || "");
                  setClientAddress(selected.address || "");
                }
              }}
              className={fieldClass}
            >
              <option value="">Manual client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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
        onClose={() => setPaymentInvoiceId(null)}
        title="Record payment"
      >
        <form onSubmit={recordPayment} className="space-y-3">
          <label className={labelClass}>
            Amount
            <input
              required
              type="number"
              step="0.001"
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
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPaymentInvoiceId(null)}
              className={`flex-1 ${secondaryBtnClass}`}
            >
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${primaryBtnClass}`}>
              Save payment
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(historyInvoice)}
        onClose={() => setHistoryInvoiceId(null)}
        title={
          historyInvoice
            ? `Activity · ${historyInvoice.invoice_number}`
            : "Payment activity"
        }
      >
        {(historyInvoice?.invoice_payment_events || []).length === 0 &&
        (historyInvoice?.invoice_payments || []).length === 0 ? (
          <p className="text-sm text-navy/55">No payment activity yet.</p>
        ) : (
          <ul className="divide-y divide-mist">
            {(historyInvoice?.invoice_payment_events || [])
              .slice()
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((event) => (
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
                      {event.method
                        ? ` · ${PAYMENT_METHODS.find((m) => m.value === event.method)?.label || event.method}`
                        : ""}
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
        )}
        {(historyInvoice?.invoice_payments || []).length ? (
          <div className="mt-4 border-t border-mist pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy/45">
              Active payments
            </p>
            <ul className="divide-y divide-mist">
              {(historyInvoice?.invoice_payments || [])
                .slice()
                .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                .map((payment) => (
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
                        {payment.method
                          ? ` · ${PAYMENT_METHODS.find((m) => m.value === payment.method)?.label || payment.method}`
                          : ""}
                      </p>
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
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
