/**
 * Quotation rules and database writes, kept apart from the screen.
 */
import type { createClient } from "@/lib/supabase/client";
import { insertWithNextNumber } from "@/lib/docNumber";
import type { InvoicePdfSource } from "@/lib/invoicePdf";
import { bySortOrder, type LineItemRow } from "@/lib/lineItems";
import type { Project, Quotation, QuotationItem } from "@/lib/types";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type ProjectOption = Pick<Project, "id" | "title" | "client_id">;

export type QuotationRow = Quotation & {
  quotation_items?: QuotationItem[];
  clients?: { name: string } | null;
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

/** Allowed manual status changes. Accepted, declined and expired are final. */
export const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["sent", "expired"],
  sent: ["accepted", "declined", "expired"],
};

/** Stored statuses from which a quotation may become an invoice. */
const CONVERTIBLE_STATUSES = ["draft", "sent", "accepted"];

/**
 * Converted quotations are locked for good. `converted_at` is checked as well
 * as the invoice link, so deleting the invoice later does not reopen the
 * quotation for a second conversion.
 */
export function isConverted(q: Pick<Quotation, "converted_invoice_id" | "converted_at">) {
  return Boolean(q.converted_invoice_id || q.converted_at);
}

export function isOpen(status: string) {
  return status === "draft" || status === "sent";
}

/** Stored status, except that an open quotation past its validity date reads as expired. */
export function effectiveStatus(q: QuotationRow, today: string) {
  if (!isConverted(q) && isOpen(q.status) && q.valid_until && q.valid_until < today) {
    return "expired";
  }
  return q.status;
}

export function canConvert(q: QuotationRow) {
  return !isConverted(q) && CONVERTIBLE_STATUSES.includes(q.status);
}

/** A quotation in the row shape the shared PDF builder expects. */
export function toPdfSource(q: QuotationRow, status: string): InvoicePdfSource {
  return {
    id: q.id,
    invoice_number: q.quote_number,
    client_name: q.client_name,
    client_email: q.client_email,
    client_address: q.client_address,
    client_id: q.client_id,
    currency: q.currency,
    status,
    subtotal: q.subtotal,
    discount_percent: q.discount_percent,
    discount_amount: q.discount_amount,
    tax_percent: q.tax_percent,
    tax_label: q.tax_label,
    total: q.total,
    amount_paid: 0,
    due_date: null,
    valid_until: q.valid_until,
    notes: q.notes,
    created_at: q.created_at,
    invoice_items: bySortOrder(q.quotation_items).map((item) => ({
      id: item.id,
      invoice_id: q.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    })),
  };
}

/** `error` is null when the write went through; `refresh` asks for a reload of the list. */
export type WriteResult = { error: string | null; refresh: boolean };

/**
 * Creates a quotation, or replaces the details and line items of an existing
 * unconverted one.
 */
export async function saveQuotation(
  supabase: SupabaseBrowserClient,
  input: { editingId: string | null; payload: Record<string, unknown>; items: LineItemRow[] },
): Promise<WriteResult> {
  const { editingId, payload, items } = input;
  const stop = (error: string, refresh = false): WriteResult => ({ error, refresh });

  if (editingId) {
    // 1. Remember which item rows exist now. They are only deleted once
    //    their replacements are safely stored.
    const { data: oldItems, error: oldItemsError } = await supabase
      .from("quotation_items")
      .select("id")
      .eq("quotation_id", editingId);
    if (oldItemsError) return stop(oldItemsError.message);
    const oldItemIds = (oldItems || []).map((row) => row.id as string);

    // 2. Insert the new items.
    const { data: newItems, error: itemError } = await supabase
      .from("quotation_items")
      .insert(items.map((line) => ({ ...line, quotation_id: editingId })))
      .select("id");
    if (itemError) return stop(`Line items were not saved: ${itemError.message}`);
    const newItemIds = (newItems || []).map((row) => row.id as string);

    // 3. Update the quotation (never a converted one); undo the inserted
    //    items if that fails or nothing was updated.
    const { data: updatedRows, error: updateError } = await supabase
      .from("quotations")
      .update(payload)
      .eq("id", editingId)
      .is("converted_invoice_id", null)
      .is("converted_at", null)
      .select("id");
    if (updateError || !updatedRows?.length) {
      const reason = updateError
        ? updateError.message
        : "This quotation was converted to an invoice or deleted meanwhile, so it was not changed";
      const { error: undoError } = newItemIds.length
        ? await supabase.from("quotation_items").delete().in("id", newItemIds)
        : { error: null };
      return stop(
        undoError
          ? `${reason}. The new line items could not be rolled back (${undoError.message}); reload before editing again.`
          : `${reason}.`,
        !updateError,
      );
    }

    // 4. Only now remove the previous items, by id.
    if (oldItemIds.length) {
      const { error: deleteError } = await supabase
        .from("quotation_items")
        .delete()
        .in("id", oldItemIds);
      if (deleteError) {
        return stop(
          `Quotation saved, but the previous line items could not be removed: ${deleteError.message}. Save again to retry.`,
          true,
        );
      }
    }
    return { error: null, refresh: true };
  }

  // A duplicate number (someone else created a quotation meanwhile) is
  // retried once with a freshly computed number.
  const created = await insertWithNextNumber(supabase, {
    table: "quotations",
    numberColumn: "quote_number",
    prefix: "QUO",
    values: { ...payload, status: "draft" },
  });
  if (!created.ok) {
    return stop(
      created.duplicate ? "That quotation number was just taken. Please try again." : created.message,
    );
  }

  const { error: itemError } = await supabase
    .from("quotation_items")
    .insert(items.map((line) => ({ ...line, quotation_id: created.id })));
  if (itemError) {
    // Do not leave a quotation without lines behind.
    const { error: undoError } = await supabase.from("quotations").delete().eq("id", created.id);
    return stop(
      undoError
        ? `Line items were not saved: ${itemError.message}. An empty quotation was left behind; delete it from the list.`
        : `Line items were not saved, so the quotation was not created: ${itemError.message}`,
      Boolean(undoError),
    );
  }
  return { error: null, refresh: true };
}

/**
 * Removes an invoice created by a conversion that could not be completed.
 * Returns an error message, or null when nothing was left behind.
 */
async function discardInvoice(
  supabase: SupabaseBrowserClient,
  invoiceId: string,
): Promise<string | null> {
  const { error: itemsError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);
  if (itemsError) return itemsError.message;
  const { error: invoiceError } = await supabase.from("invoices").delete().eq("id", invoiceId);
  return invoiceError ? invoiceError.message : null;
}

export type ConversionResult =
  | { ok: true; invoiceNumber: string }
  | { ok: false; message: string; refresh: boolean };

/** One-way, one-time: quotation → invoice. */
export async function convertQuotationToInvoice(
  supabase: SupabaseBrowserClient,
  quotationId: string,
): Promise<ConversionResult> {
  const fail = (message: string, refresh = false): ConversionResult => ({
    ok: false,
    message,
    refresh,
  });

  try {
    // (a) Work from what is in the database right now, not the page data.
    const { data: freshRow, error: readError } = await supabase
      .from("quotations")
      .select("*, quotation_items(*)")
      .eq("id", quotationId)
      .maybeSingle();
    if (readError) return fail(`Could not load the quotation: ${readError.message}`);
    if (!freshRow) return fail("This quotation no longer exists.", true);

    const fresh = freshRow as QuotationRow;
    if (isConverted(fresh)) {
      return fail("This quotation has already been converted to an invoice.", true);
    }
    if (!CONVERTIBLE_STATUSES.includes(fresh.status)) {
      return fail(
        `A quotation that is ${STATUS_LABELS[fresh.status]?.toLowerCase() || fresh.status} cannot be converted.`,
        true,
      );
    }
    const items = bySortOrder(fresh.quotation_items);
    if (!items.length) {
      return fail("This quotation has no line items. Add at least one before converting.");
    }

    // (b) Create the invoice and copy the lines one for one.
    const origin = `From quotation ${fresh.quote_number}`;
    const created = await insertWithNextNumber(supabase, {
      table: "invoices",
      numberColumn: "invoice_number",
      prefix: "INV",
      values: {
        client_id: fresh.client_id,
        client_name: fresh.client_name,
        client_email: fresh.client_email,
        client_address: fresh.client_address,
        project_id: fresh.project_id,
        quotation_id: fresh.id,
        currency: fresh.currency,
        subtotal: fresh.subtotal,
        discount_percent: fresh.discount_percent,
        discount_amount: fresh.discount_amount,
        tax_percent: fresh.tax_percent,
        tax_label: fresh.tax_label,
        total: fresh.total,
        amount_paid: 0,
        status: "draft",
        notes: fresh.notes ? `${origin}\n${fresh.notes}` : origin,
      },
    });
    if (!created.ok) {
      return fail(
        created.duplicate
          ? "That invoice number was just taken. Nothing was converted; please try again."
          : `The invoice was not created: ${created.message}`,
      );
    }

    const { error: itemError } = await supabase.from("invoice_items").insert(
      items.map((item, index) => ({
        invoice_id: created.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: index,
      })),
    );
    if (itemError) {
      const undoError = await discardInvoice(supabase, created.id);
      return fail(
        undoError
          ? `The invoice lines were not saved (${itemError.message}) and invoice ${created.number} could not be removed (${undoError}). Delete it from Invoices; the quotation is unchanged.`
          : `The invoice lines were not saved, so nothing was converted: ${itemError.message}`,
      );
    }

    // (c) Claim the quotation. The filters make a concurrent second
    //     conversion update zero rows.
    const { data: claimed, error: claimError } = await supabase
      .from("quotations")
      .update({
        converted_invoice_id: created.id,
        converted_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("id", fresh.id)
      .is("converted_invoice_id", null)
      .is("converted_at", null)
      .select("id");
    if (claimError || !claimed?.length) {
      const undoError = await discardInvoice(supabase, created.id);
      const reason = claimError
        ? `The quotation could not be marked as converted (${claimError.message})`
        : "This quotation was already converted to an invoice";
      return fail(
        undoError
          ? `${reason}, and the duplicate invoice ${created.number} could not be removed (${undoError}). Delete it from Invoices.`
          : `${reason}. No new invoice was kept.`,
        true,
      );
    }

    return { ok: true, invoiceNumber: created.number };
  } catch (err) {
    return fail(
      `Conversion did not finish${err instanceof Error && err.message ? `: ${err.message}` : "."} Reload and check Invoices before trying again.`,
    );
  }
}
