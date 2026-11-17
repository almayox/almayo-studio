"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { filterBySearch, ListFilters } from "@/components/ui/ListFilters";
import { Toggle } from "@/components/ui/Toggle";
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
import { CatalogIconPicker } from "@/components/CatalogIconPicker";
import { isCatalogIconUrl, resolveCatalogIcon } from "@/lib/catalogIcons";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CatalogWithStats } from "@/lib/types";
import { slugify } from "@/lib/types";
import { StorageImage } from "@/components/StorageMedia";

export function CatalogsManager({ initialCatalogs }: { initialCatalogs: CatalogWithStats[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const filteredCatalogs = useMemo(() => {
    let rows = filterBySearch(initialCatalogs, search, (c) =>
      [c.name, c.description, c.slug].filter(Boolean).join(" "),
    );
    if (visibilityFilter === "visible") rows = rows.filter((c) => c.is_visible);
    if (visibilityFilter === "hidden") rows = rows.filter((c) => !c.is_visible);
    return rows;
  }, [initialCatalogs, search, visibilityFilter]);

  const pagination = usePagination(filteredCatalogs, 10);

  function close() {
    setOpen(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setIcon("");
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setIcon("");
    setError(null);
    setOpen(true);
  }

  function startEdit(catalog: CatalogWithStats) {
    setEditingId(catalog.id);
    setName(catalog.name);
    setDescription(catalog.description || "");
    setIcon(catalog.icon || "");
    setError(null);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      name,
      slug: slugify(name),
      description: description || null,
      icon: icon.trim() || null,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("catalogs")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("catalogs").insert({
        ...payload,
        is_visible: true,
        sort_order: initialCatalogs.length,
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

  async function setVisible(catalog: CatalogWithStats, next: boolean) {
    const supabase = createClient();
    await supabase.from("catalogs").update({ is_visible: next }).eq("id", catalog.id);
    router.refresh();
  }

  async function remove(catalog: CatalogWithStats) {
    if (!window.confirm(`Delete catalog “${catalog.name}”?`)) return;
    const supabase = createClient();
    await supabase.from("catalogs").delete().eq("id", catalog.id);
    router.refresh();
  }

  const visibleCount = initialCatalogs.filter((c) => c.is_visible).length;
  const totalProjects = initialCatalogs.reduce((n, c) => n + c.project_count, 0);

  return (
    <div>
      <PageHeader
        title="Catalogs"
        description="Work categories shown on the public site."
        action={
          <button type="button" onClick={startCreate} className={primaryBtnClass}>
            Add catalog
          </button>
        }
      />

      <SummaryCards
        items={[
          { label: "Total", value: initialCatalogs.length, tone: "blue" },
          { label: "Visible", value: visibleCount, tone: "green" },
          { label: "Projects", value: totalProjects, tone: "purple" },
        ]}
      />

      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search catalog name…"
        status={visibilityFilter}
        onStatusChange={setVisibilityFilter}
        statusLabel="Visibility"
        statusOptions={[
          { value: "visible", label: "Visible" },
          { value: "hidden", label: "Hidden" },
        ]}
      />

      {filteredCatalogs.length === 0 ? (
        <EmptyState
          message={
            initialCatalogs.length === 0
              ? "No catalogs yet. Add your first work category."
              : "No catalogs match your filters."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
              <tr>
                <th className="px-4 py-3 font-medium">Icon</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Projects</th>
                <th className="px-4 py-3 font-medium">Visible</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pagination.pageItems.map((catalog) => {
                const CatalogIcon = resolveCatalogIcon(
                  isCatalogIconUrl(catalog.icon) ? null : catalog.icon,
                );
                return (
                <tr key={catalog.id} className="align-middle hover:bg-subtle/40">
                  <td className="px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fg/5 text-fg">
                      {isCatalogIconUrl(catalog.icon) ? (
                        <StorageImage
                          src={catalog.icon!}
                          alt=""
                          className="h-6 w-6 object-contain"
                        />
                      ) : catalog.icon ? (
                        <CatalogIcon className="h-5 w-5" aria-hidden />
                      ) : (
                        <span className="font-[family-name:var(--font-display)] text-sm">
                          {catalog.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{catalog.name}</p>
                    <p className="text-xs text-fg/45">/{catalog.slug}</p>
                    {catalog.description ? (
                      <p className="mt-1 line-clamp-1 text-xs text-fg/50">
                        {catalog.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-fg/70">
                    <span className="font-medium tabular-nums text-fg">
                      {catalog.project_count}
                    </span>
                    <span className="text-xs text-fg/45">
                      {" "}
                      project{catalog.project_count === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      checked={catalog.is_visible}
                      onChange={(next) => setVisible(catalog, next)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ActionGroup>
                      <ActionButton
                        icon={Pencil}
                        label="Edit"
                        onClick={() => startEdit(catalog)}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete"
                        danger
                        onClick={() => remove(catalog)}
                      />
                    </ActionGroup>
                  </td>
                </tr>
              );
              })}
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
        title={editingId ? "Edit catalog" : "Add catalog"}
        description="Name and description for the public Work section."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <label className={labelClass}>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </label>
          <CatalogIconPicker value={icon} onChange={setIcon} />
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className={`flex-1 ${secondaryBtnClass}`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`flex-1 ${primaryBtnClass}`}>
              {saving ? "Saving…" : editingId ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
