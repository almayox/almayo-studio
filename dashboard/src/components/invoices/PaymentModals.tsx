"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import {
  PAYMENT_METHODS,
  addPayment,
  invoiceBalance,
  methodLabel,
  removePayment,
  type InvoiceRow,
} from "@/lib/invoices";
import { createClient } from "@/lib/supabase/client";
import { round2 } from "@/lib/totals";
import type { InvoicePayment } from "@/lib/types";

function BalanceSummary({ invoice }: { invoice: InvoiceRow }) {
  const { total, paid, balance } = invoiceBalance(invoice);
  const cells = [
    { label: "Total", value: total, tone: "text-fg" },
    { label: "Paid so far", value: paid, tone: "text-emerald-700" },
    {
      label: "Balance due",
      value: balance,
      tone: balance > 0 ? "text-amber-700" : "text-emerald-700",
    },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-subtle/50 p-3">
      {cells.map((cell) => (
        <div key={cell.label}>
          <dt className="text-xs text-fg/55">{cell.label}</dt>
          <dd className={`text-sm font-semibold tabular-nums ${cell.tone}`}>
            {cell.value.toFixed(2)} {invoice.currency}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ErrorNote({ message, className = "" }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={`rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>
      {message}
    </p>
  );
}

/** Records one payment against an invoice. Mount it to open it. */
export function PaymentModal({
  invoiceId,
  invoice,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  /** Null when the invoice is no longer in the list. */
  invoice: InvoiceRow | null;
  onClose: () => void;
  /** Called once the payment exists; `problems` names any follow-up step that failed. */
  onSaved: (problems: string | null) => void;
}) {
  const [amount, setAmount] = useState(invoice ? invoiceBalance(invoice).balance.toFixed(2) : "");
  const [method, setMethod] = useState("bank_transfer");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);

    const value = round2(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      return setError("Payment amount must be greater than 0.");
    }
    if (!date) return setError("Choose the payment date.");

    setSaving(true);
    try {
      const result = await addPayment(createClient(), {
        invoiceId,
        amount: value,
        paymentDate: date,
        method,
        notes,
      });
      if (!result.saved) return setError(result.message);
      onSaved(result.problems ? `Payment saved, but ${result.problems}.` : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      description={
        invoice
          ? `${invoice.invoice_number} · part payments are allowed until the invoice is paid in full.`
          : undefined
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        {invoice ? <BalanceSummary invoice={invoice} /> : null}
        <label className={labelClass}>
          Amount
          <input
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
        </label>
        <ErrorNote message={error} />
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
            {saving ? "Saving…" : "Save payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The payments received on an invoice and the log of payment changes. */
export function PaymentHistoryModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const payments = (invoice.invoice_payments || [])
    .slice()
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const events = (invoice.invoice_payment_events || [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function remove(payment: InvoicePayment) {
    if (!window.confirm("Delete this payment?")) return;
    setError(null);
    const result = await removePayment(createClient(), payment, invoice.id);
    if (!result.deleted) return setError(`Payment was not deleted: ${result.message}`);
    if (result.problems) setError(`Payment deleted, but ${result.problems}.`);
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={`Payments · ${invoice.invoice_number}`}>
      <BalanceSummary invoice={invoice} />
      <ErrorNote message={error} className="mt-3" />

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg/45">
          Payments ({payments.length})
        </p>
        {payments.length === 0 ? (
          <p className="text-sm text-fg/55">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-fg">
                    {Number(payment.amount).toFixed(2)} {payment.currency}
                  </p>
                  <p className="text-xs text-fg/55">
                    {payment.payment_date}
                    {payment.method ? ` · ${methodLabel(payment.method)}` : ""}
                  </p>
                  {payment.notes ? (
                    <p className="mt-1 text-xs text-fg/45">{payment.notes}</p>
                  ) : null}
                </div>
                <ActionButton icon={Trash2} label="Delete" danger onClick={() => remove(payment)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {events.length ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg/45">
            Activity log
          </p>
          <ul className="divide-y divide-line">
            {events.map((event) => (
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
                  <p className="text-xs text-fg/55">
                    {event.payment_date || "-"}
                    {event.method ? ` · ${methodLabel(event.method)}` : ""}
                    {" · "}
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.notes ? <p className="mt-1 text-xs text-fg/45">{event.notes}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}
