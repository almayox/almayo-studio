"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LineItemsEditor } from "@/components/billing/LineItemsEditor";
import { PricingFields } from "@/components/billing/PricingFields";
import { useBillingDraft } from "@/components/billing/useBillingDraft";
import { Modal } from "@/components/ui/Modal";
import {
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/ui/PageChrome";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { saveInvoice, type InvoiceRow } from "@/lib/invoices";
import { lineItemsProblem } from "@/lib/lineItems";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

/** The create / edit dialog. Mount it to open it; it starts from `editing`. */
export function InvoiceForm({
  editing,
  clients,
  nextNumber,
  onClose,
}: {
  /** The invoice being edited, or null for a new one. */
  editing: InvoiceRow | null;
  clients: Client[];
  /** Preview only; the real number is computed from the database on save. */
  nextNumber: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const billing = useBillingDraft(editing, editing?.invoice_items);
  const [clientId, setClientId] = useState(editing?.client_id || "");
  const [clientName, setClientName] = useState(editing?.client_name || "");
  const [clientEmail, setClientEmail] = useState(editing?.client_email || "");
  const [clientAddress, setClientAddress] = useState(editing?.client_address || "");
  const [dueDate, setDueDate] = useState(editing?.due_date || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function chooseClient(id: string) {
    setClientId(id);
    const selected = clients.find((c) => c.id === id);
    if (selected) {
      setClientName(selected.name);
      setClientEmail(selected.email || "");
      setClientAddress(selected.address || "");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const problem = lineItemsProblem(billing.items);
    if (problem) return setError(problem);

    setSaving(true);
    setError(null);
    const result = await saveInvoice(createClient(), {
      editing,
      items: billing.items,
      total: billing.totals.total,
      payload: {
        client_name: clientName,
        client_email: clientEmail || null,
        client_address: clientAddress || null,
        client_id: clientId || null,
        ...billing.pricing,
        due_date: dueDate || null,
        notes: notes || null,
      },
    });
    setSaving(false);

    if (result.refresh) router.refresh();
    if (result.error) return setError(result.error);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit invoice" : "New invoice"}
      description={editing ? "Update client, lines, tax & discount." : `Number: ${nextNumber}`}
      wide
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <label className={labelClass}>
          Existing client
          <SearchSelect
            value={clientId}
            onChange={chooseClient}
            placeholder="Search clients…"
            emptyLabel="Manual client"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
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

        <LineItemsEditor draft={billing} />
        <PricingFields draft={billing} />

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
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
            {saving ? "Saving…" : editing ? "Save invoice" : "Create invoice"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
