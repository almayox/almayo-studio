"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
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
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";
import { slugify } from "@/lib/types";

const stages = ["new", "contacted", "qualified", "won", "lost"];

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  service_interested: "",
  message: "",
  stage: "new",
  source: "manual",
  notes: "",
};

export function LeadsManager({ initialLeads }: { initialLeads: Lead[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const leads = useMemo(() => {
    let rows = filterBySearch(initialLeads, search, (lead) =>
      [lead.full_name, lead.email, lead.phone, lead.service_interested, lead.message, lead.notes]
        .filter(Boolean)
        .join(" "),
    );
    if (filter !== "all") rows = rows.filter((l) => l.stage === filter);
    return rows;
  }, [initialLeads, filter, search]);

  const pagination = usePagination(leads, 10);

  const wonCount = initialLeads.filter((l) => l.stage === "won").length;
  const lostCount = initialLeads.filter((l) => l.stage === "lost").length;
  const closedCount = wonCount + lostCount;
  const conversionPct =
    closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }

  function startEdit(lead: Lead) {
    setEditingId(lead.id);
    setForm({
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone || "",
      service_interested: lead.service_interested || "",
      message: lead.message || "",
      stage: lead.stage || "new",
      source: lead.source || "manual",
      notes: lead.notes || "",
    });
    setError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      service_interested: form.service_interested.trim() || null,
      message: form.message.trim() || null,
      stage: form.stage,
      source: form.source || "manual",
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      const { data: updated, error: updateError } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", editingId)
        .select("id")
        .maybeSingle();
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      if (!updated) {
        setError("Could not save lead. Check you are signed in and RLS allows updates.");
        setSaving(false);
        return;
      }
      setMessage("Lead updated.");
    } else {
      const { data: created, error: insertError } = await supabase
        .from("leads")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      if (!created) {
        setError("Could not create lead. Check permissions.");
        setSaving(false);
        return;
      }
      setMessage("Lead created.");
    }

    setSaving(false);
    close();
    router.refresh();
  }

  async function updateStage(id: string, stage: string) {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("leads")
      .update({ stage })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function convertToClient(lead: Lead) {
    if (!window.confirm(`Convert “${lead.full_name}” to a client?`)) return;
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const baseSlug = slugify(lead.full_name) || `lead-${lead.id.slice(0, 8)}`;
    const { error: insertError } = await supabase.from("clients").insert({
      name: lead.full_name,
      slug: `${baseSlug}-${Date.now().toString(36).slice(-4)}`,
      email: lead.email || null,
      phone: lead.phone || null,
      description: lead.message || null,
      work_types: lead.service_interested || null,
      is_visible: false,
      sort_order: 0,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await supabase.from("leads").update({ stage: "won" }).eq("id", lead.id);
    setMessage(`“${lead.full_name}” added to Clients (hidden).`);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this lead?")) return;
    const supabase = createClient();
    await supabase.from("leads").delete().eq("id", id);
    router.refresh();
  }

  function exportCsv() {
    const header = [
      "full_name",
      "email",
      "phone",
      "service_interested",
      "stage",
      "source",
      "message",
      "notes",
      "created_at",
    ];
    const rows = initialLeads.map((lead) =>
      [
        lead.full_name,
        lead.email,
        lead.phone || "",
        lead.service_interested || "",
        lead.stage,
        lead.source,
        (lead.message || "").replace(/\n/g, " "),
        (lead.notes || "").replace(/\n/g, " "),
        lead.created_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        description="CRM inbox from the contact form and manual entries."
        action={
          <>
            <button type="button" onClick={exportCsv} className={secondaryBtnClass}>
              Export CSV
            </button>
            <button type="button" onClick={startCreate} className={primaryBtnClass}>
              Add lead
            </button>
          </>
        }
      />

      <SummaryCards
        items={[
          { label: "Total", value: initialLeads.length, tone: "blue" },
          { label: "Won", value: wonCount, tone: "green" },
          { label: "Lost", value: lostCount, tone: "red" },
          { label: "Conversion %", value: `${conversionPct}%`, tone: "purple" },
        ]}
      />

      {message ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error && !open ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, service, notes…"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...stages].map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setFilter(stage)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              filter === stage
                ? "border-navy bg-navy text-white"
                : "border-mist bg-white text-navy/65 hover:bg-foam"
            }`}
          >
            {stage}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <EmptyState message="No leads in this filter." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="overflow-hidden rounded-2xl border border-mist bg-white md:hidden">
            <div className="space-y-3 p-4">
            {pagination.pageItems.map((lead) => (
              <article
                key={lead.id}
                className="rounded-2xl border border-mist bg-white p-4"
              >
                <p className="font-medium text-navy">{lead.full_name}</p>
                <p className="text-xs text-navy/55">{lead.email}</p>
                {lead.phone ? (
                  <p className="text-xs text-navy/45">{lead.phone}</p>
                ) : null}
                <p className="mt-2 text-xs text-navy/60">
                  {lead.service_interested || "-"}
                </p>
                {lead.notes ? (
                  <p className="mt-2 rounded-lg bg-foam px-2 py-1.5 text-xs text-navy/70">
                    Notes: {lead.notes}
                  </p>
                ) : null}
                <div className="mt-3">
                  <ActionGroup>
                    <select
                      value={lead.stage}
                      onChange={(e) => updateStage(lead.id, e.target.value)}
                      className={inlineSelectClass}
                    >
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                    <ActionButton
                      icon={Pencil}
                      label="Edit"
                      onClick={() => startEdit(lead)}
                    />
                    <ActionButton
                      icon={UserPlus}
                      label="→ Client"
                      onClick={() => convertToClient(lead)}
                    />
                    <ActionButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      onClick={() => remove(lead.id)}
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

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-mist bg-white md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-mist bg-foam text-xs uppercase tracking-wide text-navy/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {pagination.pageItems.map((lead) => (
                  <tr key={lead.id} className="align-top hover:bg-foam/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{lead.full_name}</p>
                      <p className="text-xs text-navy/55">{lead.email}</p>
                      {lead.phone ? (
                        <p className="text-xs text-navy/45">{lead.phone}</p>
                      ) : null}
                      {lead.message ? (
                        <p className="mt-1 max-w-sm text-xs text-navy/60">{lead.message}</p>
                      ) : null}
                      {lead.notes ? (
                        <p className="mt-1 max-w-sm rounded-md bg-foam px-2 py-1 text-xs text-navy/65">
                          Notes: {lead.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-navy/70">
                      {lead.service_interested || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.stage}
                        onChange={(e) => updateStage(lead.id, e.target.value)}
                        className={inlineSelectClass}
                      >
                        {stages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <ActionGroup>
                        <ActionButton
                          icon={Pencil}
                          label="Edit"
                          onClick={() => startEdit(lead)}
                        />
                        <ActionButton
                          icon={UserPlus}
                          label="→ Client"
                          onClick={() => convertToClient(lead)}
                        />
                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          danger
                          onClick={() => remove(lead.id)}
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
        open={open}
        onClose={close}
        title={editingId ? "Edit lead" : "Add lead"}
        description="Contact details, stage, and internal notes."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Full name
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Service interested
            <input
              value={form.service_interested}
              onChange={(e) =>
                setForm((p) => ({ ...p, service_interested: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Stage
              <select
                value={form.stage}
                onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
                className={fieldClass}
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Source
              <input
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Message
            <textarea
              rows={2}
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Internal notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Private notes (only you see these)"
              className={fieldClass}
            />
          </label>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save lead" : "Create lead"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
