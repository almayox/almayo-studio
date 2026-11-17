"use client";

import { PaginationBar, usePagination } from "@/components/ui/Pagination";
import { ActionGroup } from "@/components/ui/PageChrome";
import { ActionButton } from "@/components/ui/ActionButton";
import { Pencil } from "lucide-react";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import type { Project } from "@/lib/types";

function ContractBadge({ required, status }: { required: boolean; status?: string }) {
  if (!required) return <span className="text-xs text-fg/40">Not needed</span>;
  const tone =
    status === "signed"
      ? "bg-emerald-50 text-emerald-700"
      : status
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}>
      {status || "Missing"}
    </span>
  );
}

export function ProjectsTable({
  projects,
  clientNames = {},
  contractStatus = {},
}: {
  projects: Project[];
  clientNames?: Record<string, string>;
  contractStatus?: Record<string, string>;
}) {
  const pagination = usePagination(projects, 10);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Client</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">Contract</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Featured</th>
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
                  <span className="text-xs font-medium text-red-700">No client</span>
                )}
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
                  <DeleteProjectButton id={project.id} title={project.title} />
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
  );
}
