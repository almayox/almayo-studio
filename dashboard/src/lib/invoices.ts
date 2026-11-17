/**
 * Invoice rules and database writes, kept apart from the screen.
 */
import type { createClient } from "@/lib/supabase/client";
import { insertWithNextNumber } from "@/lib/docNumber";
import type { LineItemRow } from "@/lib/lineItems";
import { round2 } from "@/lib/totals";
import type { Invoice, InvoiceItem, InvoicePayment, InvoicePaymentEvent } from "@/lib/types";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type InvoiceRow = Invoice & {
  invoice_items?: InvoiceItem[];
  invoice_payments?: InvoicePayment[];
  invoice_payment_events?: InvoicePaymentEvent[];
};

export const INVOICE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYMENT_METHODS = [
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

export function methodLabel(method: string | null) {
  if (!method) return "";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
}

/** Status implied by the payments received; keeps the current one when nothing is paid. */
function statusForPayments(current: string, paid: number, total: number) {
  if (paid <= 0) {
    return current === "paid" || current === PARTIAL_STATUS ? "sent" : current;
  }
  return paid >= total ? "paid" : PARTIAL_STATUS;
}

export function invoiceBalance(invoice: Pick<Invoice, "total" | "amount_paid">) {
  const total = Number(invoice.total) || 0;
  const paid = Number(invoice.amount_paid || 0);
  return { total, paid, balance: Math.max(0, round2(total - paid)) };
}

/** A mailto: link that opens a ready-written email with the invoice details. */
export function invoiceMailto(invoice: InvoiceRow) {
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
  return `mailto:${invoice.client_email || ""}?subject=${subject}&body=${body}`;
}

/** `error` is null when the write went through; `refresh` asks for a reload of the list. */
export type WriteResult = { error: string | null; refresh: boolean };

/** Creates an invoice, or replaces the details and line items of an existing one. */
export async function saveInvoice(
  supabase: SupabaseBrowserClient,
  input: {
    /** The invoice being edited, or null for a new one. */
    editing: InvoiceRow | null;
    payload: Record<string, unknown>;
    items: LineItemRow[];
    total: number;
  },
): Promise<WriteResult> {
  const { editing, payload, items, total } = input;
  const stop = (error: string, refresh = false): WriteResult => ({ error, refresh });

  if (editing) {
    // A changed total can change what the payments already received mean.
    const status = statusForPayments(
      editing.status || "draft",
      Number(editing.amount_paid || 0),
      total,
    );

    // 1. Remember which item rows exist now. They are only deleted once
    //    their replacements are safely stored.
    const { data: oldItems, error: oldItemsError } = await supabase
      .from("invoice_items")
      .select("id")
      .eq("invoice_id", editing.id);
    if (oldItemsError) return stop(oldItemsError.message);
    const oldItemIds = (oldItems || []).map((row) => row.id as string);

    // 2. Insert the new items.
    const { data: newItems, error: itemError } = await supabase
      .from("invoice_items")
      .insert(items.map((line) => ({ ...line, invoice_id: editing.id })))
      .select("id");
    if (itemError) return stop(`Line items were not saved: ${itemError.message}`);
    const newItemIds = (newItems || []).map((row) => row.id as string);

    // 3. Update the invoice; undo the inserted items if that fails.
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ ...payload, status })
      .eq("id", editing.id);
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
        return stop(
          `Invoice saved, but the previous line items could not be removed: ${deleteError.message}. Save again to retry.`,
          true,
        );
      }
    }
    return { error: null, refresh: true };
  }

  // A duplicate number (someone else created an invoice meanwhile) is
  // retried once with a freshly computed number.
  const created = await insertWithNextNumber(supabase, {
    table: "invoices",
    numberColumn: "invoice_number",
    prefix: "INV",
    values: { ...payload, status: "draft", amount_paid: 0 },
  });
  if (!created.ok) {
    return stop(
      created.duplicate ? "That invoice number was just taken. Please try again." : created.message,
    );
  }

  const { error: itemError } = await supabase
    .from("invoice_items")
    .insert(items.map((line) => ({ ...line, invoice_id: created.id })));
  if (itemError) {
    // Do not leave an invoice without lines behind.
    const { error: undoError } = await supabase.from("invoices").delete().eq("id", created.id);
    return stop(
      undoError
        ? `Line items were not saved: ${itemError.message}. An empty invoice was left behind; delete it from the list.`
        : `Line items were not saved, so the invoice was not created: ${itemError.message}`,
      Boolean(undoError),
    );
  }
  return { error: null, refresh: true };
}

export async function deleteInvoice(
  supabase: SupabaseBrowserClient,
  id: string,
): Promise<WriteResult> {
  // Items, payments and events are removed with the invoice by the
  // database (on delete cascade), so this is a single all-or-nothing delete.
  let { error: deleteError } = await supabase.from("invoices").delete().eq("id", id);

  if (deleteError?.code === FOREIGN_KEY_VIOLATION) {
    // Database without the cascade rules: remove the child rows first.
    for (const table of ["invoice_payment_events", "invoice_payments", "invoice_items"]) {
      const { error: childError } = await supabase.from(table).delete().eq("invoice_id", id);
      if (childError) {
        return { error: `Invoice was not deleted: ${childError.message}`, refresh: true };
      }
    }
    ({ error: deleteError } = await supabase.from("invoices").delete().eq("id", id));
  }

  if (deleteError) {
    return { error: `Invoice was not deleted: ${deleteError.message}`, refresh: false };
  }
  return { error: null, refresh: true };
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

  const paid = round2((payments || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: paid,
      status: statusForPayments(String(invoice.status), paid, Number(invoice.total) || 0),
    })
    .eq("id", invoiceId);
  return updateError ? updateError.message : null;
}

/** "a and b" for the bookkeeping steps that failed after a payment change, or null. */
function joinProblems(problems: string[]) {
  return problems.length ? problems.join(" and ") : null;
}

export type AddPaymentResult =
  /** Nothing was saved. */
  | { saved: false; message: string }
  /** The payment exists; `problems` names any follow-up step that failed. */
  | { saved: true; problems: string | null };

/** Records a part or full payment, never more than the balance due. */
export async function addPayment(
  supabase: SupabaseBrowserClient,
  input: { invoiceId: string; amount: number; paymentDate: string; method: string; notes: string },
): Promise<AddPaymentResult> {
  const { invoiceId, amount, paymentDate, method } = input;
  const notes = input.notes || null;

  // Validate against what is in the database right now, not the page data.
  const [invoiceResult, paymentsResult] = await Promise.all([
    supabase.from("invoices").select("total, currency").eq("id", invoiceId).single(),
    supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (invoiceResult.error || paymentsResult.error) {
    return {
      saved: false,
      message:
        (invoiceResult.error || paymentsResult.error)?.message || "Could not load the invoice.",
    };
  }
  const currency = String(invoiceResult.data.currency);
  const paidSoFar = round2(
    (paymentsResult.data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  );
  const remaining = round2((Number(invoiceResult.data.total) || 0) - paidSoFar);
  if (remaining <= 0) return { saved: false, message: "This invoice is already paid in full." };
  if (amount > remaining) {
    return {
      saved: false,
      message: `Payment cannot be more than the balance due (${remaining.toFixed(2)} ${currency}).`,
    };
  }

  const { data: payment, error: payError } = await supabase
    .from("invoice_payments")
    .insert({ invoice_id: invoiceId, amount, currency, payment_date: paymentDate, method, notes })
    .select("id")
    .single();
  if (payError) return { saved: false, message: payError.message };

  // The payment exists from here on: finish the bookkeeping and report
  // anything that failed instead of asking for a re-submit.
  const problems: string[] = [];
  const syncError = await syncInvoicePayments(supabase, invoiceId);
  if (syncError) problems.push(`the invoice paid amount/status was not updated (${syncError})`);

  const { error: eventError } = await supabase.from("invoice_payment_events").insert({
    invoice_id: invoiceId,
    action: "added",
    amount,
    currency,
    payment_date: paymentDate,
    method,
    notes,
    payment_id: payment?.id ?? null,
  });
  if (eventError) problems.push(`the activity log entry was not written (${eventError.message})`);

  return { saved: true, problems: joinProblems(problems) };
}

export type RemovePaymentResult =
  /** Nothing was deleted. */
  | { deleted: false; message: string }
  /** The payment is gone; `problems` names any follow-up step that failed. */
  | { deleted: true; problems: string | null };

export async function removePayment(
  supabase: SupabaseBrowserClient,
  payment: InvoicePayment,
  invoiceId: string,
): Promise<RemovePaymentResult> {
  const { error: deleteError } = await supabase
    .from("invoice_payments")
    .delete()
    .eq("id", payment.id);
  if (deleteError) return { deleted: false, message: deleteError.message };

  const problems: string[] = [];
  const syncError = await syncInvoicePayments(supabase, invoiceId);
  if (syncError) problems.push(`the invoice paid amount/status was not updated (${syncError})`);

  const { error: eventError } = await supabase.from("invoice_payment_events").insert({
    invoice_id: invoiceId,
    action: "deleted",
    amount: payment.amount,
    currency: payment.currency,
    payment_date: payment.payment_date,
    method: payment.method,
    notes: payment.notes,
    payment_id: payment.id,
  });
  if (eventError) problems.push(`the activity log entry was not written (${eventError.message})`);

  return { deleted: true, problems: joinProblems(problems) };
}
