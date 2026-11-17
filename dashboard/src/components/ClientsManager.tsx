"use client";

import { FormEvent, Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropUpload } from "@/components/DropUpload";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { Toggle } from "@/components/ui/Toggle";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import {
  EmptyState,
  PageHeader,
  SummaryCards,
  fieldClass,
  labelClass,
  primaryBtnClass,
  secondaryBtnClass,
  ActionGroup,
} from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadStatusLabel, uploadStudioFile, type UploadPhase } from "@/lib/upload";
import { StorageImage } from "@/components/StorageMedia";
import type { ClientProjectSummary, ClientStats } from "@/lib/types";
import { slugify } from "@/lib/types";

const emptyForm = {
  name: "",
  websiteUrl: "",
  email: "",
  phone: "",
  address: "",
  workTypes: "",
  logoUrl: "",
};

function groupByCatalog(projects: ClientProjectSummary[]) {
  const groups = new Map<string, ClientProjectSummary[]>();
  for (const project of projects) {
    const key = project.catalog_name || "Uncategorized";
    groups.set(key, [...(groups.get(key) || []), project]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function ClientsManager({ initialClients }: { initialClients: ClientStats[] }) {
  const [openProjectsFor, setOpenProjectsFor] = useState<string | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const filteredClients = useMemo(() => {
    let rows = filterBySearch(initialClients, search, (client) =>
      [client.name, client.email, client.phone, client.work_types, client.website_url]
        .filter(Boolean)
        .join(" "),
    );
    if (visibilityFilter === "visible") {
      rows = rows.filter((c) => c.is_visible);
    } else if (visibilityFilter === "hidden") {
      rows = rows.filter((c) => !c.is_visible);
    }
    return rows;
  }, [initialClients, search, visibilityFilter]);

  const pagination = usePagination(filteredClients, 10);

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

  function startEdit(client: ClientStats) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      websiteUrl: client.website_url || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      workTypes: client.work_types || "",
      logoUrl: client.logo_url || "",
    });
    setError(null);
    setOpen(true);
  }

  async function uploadLogo(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadPhase("compressing");
    setError(null);
    try {
      const publicUrl = await uploadStudioFile(file, {
        folder: "clients",
        maxEdge: 512,
        imageQuality: 0.88,
        onPhase: setUploadPhase,
      });
      setForm((prev) => ({ ...prev, logoUrl: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadPhase(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      name: form.name,
      slug: slugify(form.name),
      description: null,
      website_url: form.websiteUrl || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      work_types: form.workTypes || null,
      logo_url: form.logoUrl || null,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("clients").insert({
        ...payload,
        is_visible: true,
        sort_order: initialClients.length,
      });
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    close();
    router.refresh();
  }

  async function setVisible(client: ClientStats, next: boolean) {
    const supabase = createClient();
    await supabase.from("clients").update({ is_visible: next }).eq("id", client.id);
    router.refresh();
  }

  async function remove(client: ClientStats) {
    if (!window.confirm(`Delete client “${client.name}”?`)) return;
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", client.id);
    router.refresh();
  }

  const visibleCount = initialClients.filter((c) => c.is_visible).length;

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Companies and brands you work with. What they do, not project deliverables."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            Add client
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Total", value: initialClients.length, tone: "blue" },
          { label: "Visible", value: visibleCount, tone: "green" },
          {
            label: "With projects",
            value: initialClients.filter((c) => c.project_count > 0).length,
            tone: "purple",
          },
          {
            label: "Total projects",
            value: initialClients.reduce((n, c) => n + c.project_count, 0),
            tone: "slate",
          },
        ]}
      />

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search client, email, industry…"
        status={visibilityFilter}
        onStatusChange={setVisibilityFilter}
        statusLabel="Visibility"
        statusOptions={[
          { value: "visible", label: "Visible" },
          { value: "hidden", label: "Hidden" },
        ]}
      />

      {filteredClients.length === 0 ? (
        <EmptyState
          message={
            initialClients.length === 0
              ? "No clients yet."
              : "No clients match your filters."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Linked</th>
                <th className="px-4 py-3 font-medium">Visible</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pagination.pageItems.map((client) => (
                <Fragment key={client.id}>
                <tr className="hover:bg-subtle/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {client.logo_url ? (
                        <StorageImage
                          src={client.logo_url}
                          alt=""
                          className="h-9 w-9 rounded-lg object-contain ring-1 ring-line"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fg/5 text-xs font-semibold text-fg">
                          {client.name.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-fg">{client.name}</p>
                        <p className="text-xs text-fg/45">
                          {client.work_types || "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-fg/60 lg:table-cell">
                    <p>{client.project_count} projects</p>
                    <p>
                      {client.contract_count} contracts · {client.invoice_count} invoices ·{" "}
                      {client.campaign_count} campaigns
                    </p>
                    <p className="text-fg/45">{client.email || client.phone || "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={client.is_visible}
                      onChange={(next) => setVisible(client, next)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ActionGroup>
                      <ActionButton
                        icon={FolderOpen}
                        label="Projects"
                        onClick={() =>
                          setOpenProjectsFor((current) =>
                            current === client.id ? null : client.id,
                          )
                        }
                      />
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => startEdit(client)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => remove(client)}
                      />
                    </ActionGroup>
                  </td>
                </tr>
                {openProjectsFor === client.id ? (
                  <tr className="bg-subtle/50">
                    <td colSpan={4} className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-fg">
                          Projects for {client.name}
                        </p>
                        <Link
                          href={`/projects/new?client=${client.id}`}
                          className={secondaryBtnClass}
                        >
                          Add project
                        </Link>
                      </div>
                      {(client.projects || []).length === 0 ? (
                        <p className="mt-3 text-sm text-fg/55">
                          No projects yet for this client.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {groupByCatalog(client.projects || []).map(([catalog, items]) => (
                            <div key={catalog}>
                              <p className="text-xs font-medium uppercase tracking-wide text-fg/45">
                                {catalog}
                              </p>
                              <ul className="mt-1.5 space-y-1">
                                {items.map((project) => (
                                  <li key={project.id} className="text-sm">
                                    <Link
                                      href={`/projects/${project.id}`}
                                      className="text-fg hover:underline"
                                    >
                                      {project.title}
                                    </Link>
                                    {project.is_visible ? null : (
                                      <span className="ml-2 text-xs text-amber-700">Draft</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
                </Fragment>
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
      )}

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit client" : "Add client"}
        description="Company profile: industry/work type, contact, logo."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Email
              <input
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
            Website
            <input
              value={form.websiteUrl}
              onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            What they do (industry / work type)
            <input
              value={form.workTypes}
              onChange={(e) => setForm((p) => ({ ...p, workTypes: e.target.value }))}
              placeholder="Restaurant, F&B, Real estate, Tech…"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Address
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className={fieldClass}
            />
          </label>
          {form.logoUrl ? (
            <StorageImage src={form.logoUrl} alt="" className="h-12 w-auto object-contain" />
          ) : null}
          <DropUpload
            onFiles={uploadLogo}
            accept="image/*"
            disabled={uploading}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-subtle px-3 py-5 text-center text-sm text-fg/70"
          >
            {uploading
              ? uploadStatusLabel(uploadPhase)
              : form.logoUrl
                ? "Replace logo"
                : "Drop logo"}
          </DropUpload>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className={`flex-1 ${primaryBtnClass}`}
            >
              {saving ? "Saving…" : editingId ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
