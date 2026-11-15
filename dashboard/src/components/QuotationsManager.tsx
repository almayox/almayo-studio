"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
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
import { FileOutput, FileText, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  downloadInvoicePdf,
  PdfUnsupportedTextError,
  type InvoicePdfSource,
} from "@/lib/invoicePdf";
import { resolveStorageUrl } from "@/lib/storage";
import { insertWithNextNumber, nextDocNumber } from "@/lib/docNumber";
import { computeTotals, lineAmount, round2, type DiscountMode } from "@/lib/totals";
import type { Client, Project, Quotation, QuotationItem } from "@/lib/types";

type SupabaseBrowserClient = ReturnType<typeof createClient>;
type LineDraft = { description: string; quantity: string; unit_price: string };
type ProjectOption = Pick<Project, "id" | "title" | "client_id">;

export type QuotationRow = Quotation & {
  quotation_items?: QuotationItem[];
  clients?: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

/** Allowed manual status changes. Accepted, declined and expired are final. */
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["sent", "expired"],
  sent: ["accepted", "declined", "expired"],
};

/** Stored statuses from which a quotation may become an invoice. */
const CONVERTIBLE_STATUSES = ["draft", "sent", "accepted"];

const STATUS_TONES: Record<string, string> = {
  draft: "bg-foam text-navy/70 ring-mist",
  sent: "bg-blue-50 text-blue-800 ring-blue-100",
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  declined: "bg-red-50 text-red-700 ring-red-100",
  expired: "bg-amber-50 text-amber-800 ring-amber-100",
};

const emptyLine = (): LineDraft => ({
  description: "",
  quantity: "1",
  unit_price: "",
});

function nextQuoteNumber(existing: string[]) {
  return nextDocNumber("QUO", existing);
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

/**
 * Converted quotations are locked for good. `converted_at` is checked as well
 * as the invoice link, so deleting the invoice later does not reopen the
 * quotation for a second conversion.
 */
function isConverted(q: Pick<Quotation, "converted_invoice_id" | "converted_at">) {
  return Boolean(q.converted_invoice_id || q.converted_at);
}

function isOpen(status: string) {
  return status === "draft" || status === "sent";
}

/** Stored status, except that an open quotation past its validity date reads as expired. */
function effectiveStatus(q: QuotationRow, today: string) {
  if (!isConverted(q) && isOpen(q.status) && q.valid_until && q.valid_until < today) {
    return "expired";
  }
  return q.status;
}

function sortedItems(q: QuotationRow) {
  return (q.quotation_items || []).slice().sort((a, b) => a.sort_order - b.sort_order);
}

/** A quotation in the row shape the shared PDF builder expects. */
function toPdfSource(q: QuotationRow, status: string): InvoicePdfSource {
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
    invoice_items: sortedItems(q).map((item) => ({
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        STATUS_TONES[status] || STATUS_TONES.draft
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

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
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("KWD");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [taxPercent, setTaxPercent] = useState("");
  const [taxLabel, setTaxLabel] = useState("Tax");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertedInvoiceNumber, setConvertedInvoiceNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Shown in the form as a preview; the real number is recomputed from the
  // database at insert time.
  const nextNumber = useMemo(
    () => nextQuoteNumber(initialQuotations.map((q) => q.quote_number)),
    [initialQuotations],
  );

  const projectTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) map.set(project.id, project.title);
    return map;
  }, [projects]);

  // Only the chosen client's projects can be linked.
  const clientProjects = useMemo(
    () => (clientId ? projects.filter((project) => project.client_id === clientId) : []),
    [projects, clientId],
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

  function resetForm() {
    setEditingId(null);
    setClientId("");
    setProjectId("");
    setTitle("");
    setCurrency("KWD");
    setValidUntil("");
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

  function startEdit(q: QuotationRow) {
    if (isConverted(q)) return;
    setEditingId(q.id);
    setClientId(q.client_id || "");
    setProjectId(q.project_id || "");
    setTitle(q.title || "");
    setCurrency(q.currency || "KWD");
    setValidUntil(q.valid_until || "");
    setNotes(q.notes || "");
    setDiscountPercent(
      q.discount_percent != null && Number(q.discount_percent) > 0
        ? String(q.discount_percent)
        : "",
    );
    if (Number(q.discount_amount) > 0) {
      setDiscountMode("amount");
      setDiscountAmount(String(q.discount_amount));
    } else {
      setDiscountMode("percent");
      setDiscountAmount("");
    }
    setTaxPercent(q.tax_percent != null && Number(q.tax_percent) > 0 ? String(q.tax_percent) : "");
    setTaxLabel(q.tax_label || "Tax");
    const items = sortedItems(q);
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

  function chooseClient(id: string) {
    setClientId(id);
    // A project of another client can never stay linked.
    setProjectId((current) =>
      current && projects.some((p) => p.id === current && p.client_id === id) ? current : "",
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const stop = (message: string) => {
      setError(message);
      setSaving(false);
    };

    const client = clients.find((c) => c.id === clientId);
    if (!client) return stop("Choose a client.");
    if (projectId && !projects.some((p) => p.id === projectId && p.client_id === clientId)) {
      return stop("The selected project does not belong to this client.");
    }

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
    const existing = editingId ? initialQuotations.find((q) => q.id === editingId) : undefined;

    // Client details are stored as a snapshot, like invoices. When editing
    // without changing the client, the existing snapshot is kept.
    const snapshot =
      existing && existing.client_id === client.id
        ? {}
        : {
            client_name: client.name,
            client_email: client.email || null,
            client_address: client.address || null,
          };

    const payload = {
      ...snapshot,
      client_id: client.id,
      project_id: projectId || null,
      title: title.trim() || null,
      currency,
      subtotal: totals.subtotal,
      discount_percent:
        discountMode === "percent" && discountPercent !== "" ? Number(discountPercent) : null,
      discount_amount:
        discountMode === "amount" && discountAmount !== ""
          ? round2(Number(discountAmount))
          : null,
      tax_percent: taxPercent === "" ? null : Number(taxPercent),
      tax_label: taxLabel || null,
      total: totals.total,
      valid_until: validUntil || null,
      notes: notes || null,
    };

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
        if (!updateError) router.refresh();
        return stop(
          undoError
            ? `${reason}. The new line items could not be rolled back (${undoError.message}); reload before editing again.`
            : `${reason}.`,
        );
      }

      // 4. Only now remove the previous items, by id.
      if (oldItemIds.length) {
        const { error: deleteError } = await supabase
          .from("quotation_items")
          .delete()
          .in("id", oldItemIds);
        if (deleteError) {
          router.refresh();
          return stop(
            `Quotation saved, but the previous line items could not be removed: ${deleteError.message}. Save again to retry.`,
          );
        }
      }
    } else {
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
          created.duplicate
            ? "That quotation number was just taken. Please try again."
            : created.message,
        );
      }

      const { error: itemError } = await supabase
        .from("quotation_items")
        .insert(items.map((line) => ({ ...line, quotation_id: created.id })));
      if (itemError) {
        // Do not leave a quotation without lines behind.
        const { error: undoError } = await supabase
          .from("quotations")
          .delete()
          .eq("id", created.id);
        if (undoError) router.refresh();
        return stop(
          undoError
            ? `Line items were not saved: ${itemError.message}. An empty quotation was left behind; delete it from the list.`
            : `Line items were not saved, so the quotation was not created: ${itemError.message}`,
        );
      }
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

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
      setPageError("Status was not changed: this quotation was updated elsewhere. The list has been reloaded.");
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
    try {
      // The logo may live in a private bucket: sign it first. A logo that
      // cannot be signed or loaded is simply left out of the PDF.
      let signedLogoUrl: string | null = null;
      try {
        signedLogoUrl = await resolveStorageUrl(logoUrl);
      } catch {
        signedLogoUrl = null;
      }
      await downloadInvoicePdf(
        toPdfSource(q, effectiveStatus(q, today)),
        signedLogoUrl,
        "quotation",
      );
    } catch (err) {
      setPageError(
        err instanceof PdfUnsupportedTextError
          ? "This PDF font cannot render Arabic text yet"
          : `Could not generate the PDF${err instanceof Error && err.message ? `: ${err.message}` : "."}`,
      );
    }
  }

  function canConvert(q: QuotationRow) {
    return !isConverted(q) && CONVERTIBLE_STATUSES.includes(q.status);
  }

  function openConvert(q: QuotationRow) {
    if (!canConvert(q)) return;
    setConvertError(null);
    setConvertId(q.id);
  }

  function closeConvert() {
    if (converting) return;
    setConvertId(null);
    setConvertError(null);
  }

  /** One-way, one-time: quotation → invoice. */
  async function convertToInvoice() {
    if (!convertId || converting) return;
    const quotationId = convertId;
    setConverting(true);
    setConvertError(null);
    setPageError(null);
    const supabase = createClient();

    try {
      // (a) Work from what is in the database right now, not the page data.
      const { data: freshRow, error: readError } = await supabase
        .from("quotations")
        .select("*, quotation_items(*)")
        .eq("id", quotationId)
        .maybeSingle();
      if (readError) {
        setConvertError(`Could not load the quotation: ${readError.message}`);
        return;
      }
      if (!freshRow) {
        setConvertError("This quotation no longer exists.");
        router.refresh();
        return;
      }
      const fresh = freshRow as QuotationRow;
      if (isConverted(fresh)) {
        setConvertError("This quotation has already been converted to an invoice.");
        router.refresh();
        return;
      }
      if (!CONVERTIBLE_STATUSES.includes(fresh.status)) {
        setConvertError(
          `A quotation that is ${STATUS_LABELS[fresh.status]?.toLowerCase() || fresh.status} cannot be converted.`,
        );
        router.refresh();
        return;
      }
      const items = sortedItems(fresh);
      if (!items.length) {
        setConvertError("This quotation has no line items. Add at least one before converting.");
        return;
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
        setConvertError(
          created.duplicate
            ? "That invoice number was just taken. Nothing was converted; please try again."
            : `The invoice was not created: ${created.message}`,
        );
        return;
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
        setConvertError(
          undoError
            ? `The invoice lines were not saved (${itemError.message}) and invoice ${created.number} could not be removed (${undoError}). Delete it from Invoices; the quotation is unchanged.`
            : `The invoice lines were not saved, so nothing was converted: ${itemError.message}`,
        );
        return;
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
        setConvertError(
          undoError
            ? `${reason}, and the duplicate invoice ${created.number} could not be removed (${undoError}). Delete it from Invoices.`
            : `${reason}. No new invoice was kept.`,
        );
        router.refresh();
        return;
      }

      setConvertId(null);
      setConvertedInvoiceNumber(created.number);
      router.refresh();
    } catch (err) {
      setConvertError(
        `Conversion did not finish${err instanceof Error && err.message ? `: ${err.message}` : "."} Reload and check Invoices before trying again.`,
      );
    } finally {
      setConverting(false);
    }
  }

  const convertQuotation = convertId
    ? initialQuotations.find((q) => q.id === convertId) || null
    : null;

  function convertedLabel(q: QuotationRow) {
    if (!q.converted_invoice_id) {
      return <span className="text-xs text-navy/55">Converted · invoice deleted</span>;
    }
    return (
      <Link
        href="/invoices"
        className="text-xs font-medium text-emerald-700 hover:underline"
      >
        Converted → {invoiceNumbers[q.converted_invoice_id] || "invoice"}
      </Link>
    );
  }

  function statusCell(q: QuotationRow) {
    if (isConverted(q)) {
      return (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={q.status} />
          {convertedLabel(q)}
        </div>
      );
    }
    const next = NEXT_STATUSES[q.status] || [];
    return (
      <div className="flex flex-col items-start gap-1.5">
        <StatusBadge status={effectiveStatus(q, today)} />
        {next.length ? (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) updateStatus(q, e.target.value);
            }}
            aria-label={`Change status of ${q.quote_number}`}
            className={inlineSelectClass}
          >
            <option value="">Mark as…</option>
            {next.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  function actions(q: QuotationRow) {
    const locked = isConverted(q);
    return (
      <ActionGroup>
        {locked ? null : (
          <ActionButton icon={Pencil} label="Edit" onClick={() => startEdit(q)} />
        )}
        <ActionButton icon={FileText} label="PDF" onClick={() => downloadPdf(q)} />
        {canConvert(q) ? (
          <ActionButton
            icon={FileOutput}
            label="Convert to invoice"
            onClick={() => openConvert(q)}
          />
        ) : null}
        {locked ? null : (
          <ActionButton icon={Trash2} label="Delete" danger onClick={() => remove(q)} />
        )}
      </ActionGroup>
    );
  }

  function subline(q: QuotationRow) {
    const project = q.project_id ? projectTitles.get(q.project_id) : null;
    return [q.client_name, project].filter(Boolean).join(" · ");
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Quote a client, then convert the quotation into an invoice."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
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
        <>
          <div className="overflow-hidden rounded-2xl border border-mist bg-white md:hidden">
            <div className="space-y-3 p-4">
              {pagination.pageItems.map((q) => (
                <article key={q.id} className="rounded-2xl border border-mist bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-navy">{q.quote_number}</p>
                      {q.title ? <p className="text-sm text-navy/80">{q.title}</p> : null}
                      <p className="text-xs text-navy/55">{subline(q)}</p>
                    </div>
                    {statusCell(q)}
                  </div>
                  <p className="mt-2 text-sm text-navy">
                    {Number(q.total).toFixed(2)} {q.currency}
                    {q.valid_until ? (
                      <span className="text-navy/50"> · valid until {q.valid_until}</span>
                    ) : null}
                  </p>
                  <div className="mt-3">{actions(q)}</div>
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
                  <th className="px-4 py-3 font-medium">Quotation</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {pagination.pageItems.map((q) => (
                  <tr key={q.id} className="align-top hover:bg-foam/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{q.quote_number}</p>
                      {q.title ? <p className="text-navy/80">{q.title}</p> : null}
                      <p className="text-xs text-navy/55">{subline(q)}</p>
                      <p className="mt-1 text-xs text-navy/45">
                        {(q.quotation_items || []).length} lines
                      </p>
                    </td>
                    <td className="px-4 py-3 text-navy/80">
                      <p>
                        {Number(q.total).toFixed(2)} {q.currency}
                      </p>
                      <p className="text-xs text-navy/50">
                        {q.valid_until ? `Valid until ${q.valid_until}` : "No expiry date"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{statusCell(q)}</td>
                    <td className="px-4 py-3">{actions(q)}</td>
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
        title={editingId ? "Edit quotation" : "New quotation"}
        description={
          editingId ? "Update client, project, lines, tax & discount." : `Number: ${nextNumber}`
        }
        wide
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Client (required)
              <SearchSelect
                value={clientId}
                onChange={chooseClient}
                placeholder="Search clients…"
                options={clients.map((client) => ({
                  value: client.id,
                  label: client.name,
                }))}
              />
            </label>
            <label className={labelClass}>
              Project (optional)
              <SearchSelect
                value={projectId}
                onChange={setProjectId}
                disabled={!clientId}
                placeholder={
                  !clientId
                    ? "Choose a client first"
                    : clientProjects.length
                      ? "Search this client's projects…"
                      : "This client has no projects"
                }
                emptyLabel={clientId && clientProjects.length ? "No project" : undefined}
                options={clientProjects.map((project) => ({
                  value: project.id,
                  label: project.title,
                }))}
              />
            </label>
          </div>
          <label className={labelClass}>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website redesign"
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
                    aria-label="Remove line"
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
              <p>
                Subtotal: {draftMath.subtotal.toFixed(2)} {currency}
              </p>
              {draftMath.discount > 0 ? (
                <p className="text-navy/60">Discount: −{draftMath.discount.toFixed(2)}</p>
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
                onChange={(e) => setDiscountMode(e.target.value as DiscountMode)}
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
                  max="100"
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
            Valid until
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
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
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={closeForm} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save quotation" : "Create quotation"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(convertId)}
        onClose={closeConvert}
        title="Convert to invoice"
        description={convertQuotation ? convertQuotation.quote_number : undefined}
      >
        <div className="space-y-3">
          {convertQuotation ? (
            <p className="text-sm text-navy/80">
              A draft invoice for{" "}
              <span className="font-semibold text-navy">
                {Number(convertQuotation.total).toFixed(2)} {convertQuotation.currency}
              </span>{" "}
              will be created for {convertQuotation.client_name}, with the same line items,
              discount and tax. The quotation is marked as accepted and locked.
            </p>
          ) : null}
          {convertQuotation && effectiveStatus(convertQuotation, today) === "expired" ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This quotation is past its validity date ({convertQuotation.valid_until}).
            </p>
          ) : null}
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            This cannot be undone. A quotation can be converted only once, and an invoice can
            never be turned back into a quotation.
          </p>
          {convertError ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {convertError}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={closeConvert}
              disabled={converting}
              className={`flex-1 ${secondaryBtnClass}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={convertToInvoice}
              disabled={converting}
              className={`flex-1 ${primaryBtnClass}`}
            >
              {converting ? "Converting…" : "Convert to invoice"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
