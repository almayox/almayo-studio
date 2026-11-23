"use client";

import { useMemo, useState } from "react";
import { ListFilters } from "@/components/ui/ListFilters";
import { fieldClass, filterLabelClass } from "@/components/ui/PageChrome";
import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { ActionGroup } from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { Pencil } from "lucide-react";
import { DuplicateProjectButton } from "@/components/DuplicateProjectButton";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import type { Project } from "@/lib/types";

function ContractBadge({
  required,
  status,
}: {
  required: boolean;
  status?: string;
}) {
  if (!required) return <span className="text-xs text-fg/40">Not needed</span>;
  const tone =
    status === "signed"
      ? "bg-emerald-50 text-emerald-700"
      : status
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}
    >
      {status || "Missing"}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "featured", label: "Featured" },
];

/** The names in use by the listed projects, in A to Z order, for a filter. */
function optionsInUse(ids: (string | null)[], names: Record<string, string>) {
  return [...new Set(ids)]
    .filter((id): id is string => Boolean(id && names[id]))
    .map((id) => ({ value: id, label: names[id] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  noneLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Shown as a choice for projects that have none, when given. */
  noneLabel?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:w-40 lg:flex-none">
      <span className={filterLabelClass}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {noneLabel ? <option value="none">{noneLabel}</option> : null}
      </select>
    </label>
  );
}

export function ProjectsTable({
  projects,
  clientNames = {},
  catalogNames = {},
  contractStatus = {},
}: {
  projects: Project[];
  clientNames?: Record<string, string>;
  catalogNames?: Record<string, string>;
  contractStatus?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [client, setClient] = useState("all");
  const [catalog, setCatalog] = useState("all");

  const clientOptions = useMemo(
    () =>
      optionsInUse(
        projects.map((project) => project.client_id),
        clientNames,
      ),
    [projects, clientNames],
  );
  const catalogOptions = useMemo(
    () =>
      optionsInUse(
        projects.map((project) => project.catalog_id),
        catalogNames,
      ),
    [projects, catalogNames],
  );
  const hasNoCatalog = projects.some((project) => !project.catalog_id);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (status === "published" && !project.is_visible) return false;
      if (status === "draft" && project.is_visible) return false;
      if (status === "featured" && !project.is_featured) return false;
      if (client !== "all" && project.client_id !== client) return false;
      if (
        catalog === "none"
          ? project.catalog_id
          : catalog !== "all" && project.catalog_id !== catalog
      ) {
        return false;
      }
      if (!query) return true;
      const text = [
        project.title,
        project.slug,
        project.tags,
        project.client_id ? clientNames[project.client_id] : "",
        project.catalog_id ? catalogNames[project.catalog_id] : "",
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [projects, search, status, client, catalog, clientNames, catalogNames]);

  const pagination = usePagination(filtered, 10);
  const filtering =
    Boolean(search.trim()) ||
    status !== "all" ||
    client !== "all" ||
    catalog !== "all";

  function clear() {
    setSearch("");
    setStatus("all");
    setClient("all");
    setCatalog("all");
  }

  return (
    <>
      <ListFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Title, client, category or tag"
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        extra={
          <div className="flex w-full items-end gap-3">
            <FilterSelect
              label="Client"
              value={client}
              onChange={setClient}
              options={clientOptions}
            />
            <FilterSelect
              label="Category"
              value={catalog}
              onChange={setCatalog}
              options={catalogOptions}
              noneLabel={hasNoCatalog ? "No category" : undefined}
            />
          </div>
        }
      />
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Client
              </th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">
                Category
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Contract
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Featured
              </th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pagination.pageItems.map((project) => (
              <tr key={project.id} className="hover:bg-subtle/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{project.title}</p>
                  <p className="text-xs text-fg/45">/{project.slug}</p>
                </td>
                <td className="hidden px-4 py-3 text-fg/70 md:table-cell">
                  {project.client_id && clientNames[project.client_id] ? (
                    clientNames[project.client_id]
                  ) : (
                    <span className="text-xs font-medium text-red-700">
                      No client
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-fg/70 xl:table-cell">
                  {(project.catalog_id && catalogNames[project.catalog_id]) ||
                    "-"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      project.is_visible
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {project.is_visible ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <ContractBadge
                    required={Boolean(project.contract_required)}
                    status={contractStatus[project.id]}
                  />
                </td>
                <td className="hidden px-4 py-3 text-fg/70 sm:table-cell">
                  {project.is_featured ? "Yes" : "-"}
                </td>
                <td className="px-4 py-3">
                  <ActionGroup>
                    <ActionButton
                      icon={Pencil}
                      label="Edit"
                      href={`/projects/${project.id}`}
                    />
                    <DuplicateProjectButton project={project} />
                    <DeleteProjectButton
                      id={project.id}
                      title={project.title}
                    />
                  </ActionGroup>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-fg/55"
                >
                  No projects match these filters.{" "}
                  <button
                    type="button"
                    onClick={clear}
                    className="font-medium text-fg underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : null}
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
      {filtering && filtered.length > 0 ? (
        <p className="mt-3 text-xs text-fg/55">
          {filtered.length} of {projects.length} projects shown.{" "}
          <button
            type="button"
            onClick={clear}
            className="font-medium text-fg underline"
          >
            Clear filters
          </button>
        </p>
      ) : null}
    </>
  );
}
