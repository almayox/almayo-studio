"use client";

import { FormEvent, useMemo, useState } from "react";
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
import { lineItemsProblem } from "@/lib/lineItems";
import { saveQuotation, type ProjectOption, type QuotationRow } from "@/lib/quotations";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/lib/types";

/** The create / edit dialog. Mount it to open it; it starts from `editing`. */
export function QuotationForm({
  editing,
  clients,
  projects,
  nextNumber,
  onClose,
}: {
  /** The quotation being edited, or null for a new one. */
  editing: QuotationRow | null;
  clients: Client[];
  projects: ProjectOption[];
  /** Preview only; the real number is computed from the database on save. */
  nextNumber: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const billing = useBillingDraft(editing, editing?.quotation_items);
  const [clientId, setClientId] = useState(editing?.client_id || "");
  const [projectId, setProjectId] = useState(editing?.project_id || "");
  const [title, setTitle] = useState(editing?.title || "");
  const [validUntil, setValidUntil] = useState(editing?.valid_until || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Only the chosen client's projects can be linked.
  const clientProjects = useMemo(
    () => (clientId ? projects.filter((project) => project.client_id === clientId) : []),
    [projects, clientId],
  );

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

    const client = clients.find((c) => c.id === clientId);
    if (!client) return setError("Choose a client.");
    if (projectId && !projects.some((p) => p.id === projectId && p.client_id === clientId)) {
      return setError("The selected project does not belong to this client.");
    }
    const problem = lineItemsProblem(billing.items);
    if (problem) return setError(problem);

    // Client details are stored as a snapshot, like invoices. When editing
    // without changing the client, the existing snapshot is kept.
    const snapshot =
      editing && editing.client_id === client.id
        ? {}
        : {
            client_name: client.name,
            client_email: client.email || null,
            client_address: client.address || null,
          };

    setSaving(true);
    setError(null);
    const result = await saveQuotation(createClient(), {
      editingId: editing?.id ?? null,
      items: billing.items,
      payload: {
        ...snapshot,
        client_id: client.id,
        project_id: projectId || null,
        title: title.trim() || null,
        ...billing.pricing,
        valid_until: validUntil || null,
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
      title={editing ? "Edit quotation" : "New quotation"}
      description={
        editing ? "Update client, project, lines, tax & discount." : `Number: ${nextNumber}`
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
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
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

        <LineItemsEditor draft={billing} />
        <PricingFields draft={billing} />

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
          <button type="button" onClick={onClose} className={`flex-1 ${secondaryBtnClass}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
            {saving ? "Saving…" : editing ? "Save quotation" : "Create quotation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
