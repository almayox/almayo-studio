"use client";

import Link from "next/link";
import { FileOutput, FileText, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionGroup, inlineSelectClass } from "@/components/ui/PageChrome";
import { PaginationControls, type Pagination } from "@/components/ui/Pagination";
import {
  NEXT_STATUSES,
  STATUS_LABELS,
  canConvert,
  effectiveStatus,
  isConverted,
  type QuotationRow,
} from "@/lib/quotations";

const STATUS_TONES: Record<string, string> = {
  draft: "bg-subtle text-fg/70 ring-line",
  sent: "bg-blue-50 text-blue-800 ring-blue-100",
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  declined: "bg-red-50 text-red-700 ring-red-100",
  expired: "bg-amber-50 text-amber-800 ring-amber-100",
};

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

/** The quotations list: cards on phones, a table from tablet width up. */
export function QuotationsList({
  pagination,
  today,
  projectTitles,
  invoiceNumbers,
  onEdit,
  onPdf,
  onConvert,
  onDelete,
  onStatusChange,
}: {
  pagination: Pagination<QuotationRow>;
  today: string;
  projectTitles: Map<string, string>;
  /** Invoice id → invoice number, to label converted quotations. */
  invoiceNumbers: Record<string, string>;
  onEdit: (q: QuotationRow) => void;
  onPdf: (q: QuotationRow) => void;
  onConvert: (q: QuotationRow) => void;
  onDelete: (q: QuotationRow) => void;
  onStatusChange: (q: QuotationRow, status: string) => void;
}) {
  function convertedLabel(q: QuotationRow) {
    if (!q.converted_invoice_id) {
      return <span className="text-xs text-fg/55">Converted · invoice deleted</span>;
    }
    return (
      <Link href="/invoices" className="text-xs font-medium text-emerald-700 hover:underline">
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
              if (e.target.value) onStatusChange(q, e.target.value);
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
        {locked ? null : <ActionButton icon={Pencil} label="Edit" onClick={() => onEdit(q)} />}
        <ActionButton icon={FileText} label="PDF" onClick={() => onPdf(q)} />
        {canConvert(q) ? (
          <ActionButton icon={FileOutput} label="Convert to invoice" onClick={() => onConvert(q)} />
        ) : null}
        {locked ? null : (
          <ActionButton icon={Trash2} label="Delete" danger onClick={() => onDelete(q)} />
        )}
      </ActionGroup>
    );
  }

  function subline(q: QuotationRow) {
    const project = q.project_id ? projectTitles.get(q.project_id) : null;
    return [q.client_name, project].filter(Boolean).join(" · ");
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface md:hidden">
        <div className="space-y-3 p-4">
          {pagination.pageItems.map((q) => (
            <article key={q.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-fg">{q.quote_number}</p>
                  {q.title ? <p className="text-sm text-fg/80">{q.title}</p> : null}
                  <p className="text-xs text-fg/55">{subline(q)}</p>
                </div>
                {statusCell(q)}
              </div>
              <p className="mt-2 text-sm text-fg">
                {Number(q.total).toFixed(2)} {q.currency}
                {q.valid_until ? (
                  <span className="text-fg/50"> · valid until {q.valid_until}</span>
                ) : null}
              </p>
              <div className="mt-3">{actions(q)}</div>
            </article>
          ))}
        </div>
        <PaginationControls pagination={pagination} />
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
            <tr>
              <th className="px-4 py-3 font-medium">Quotation</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pagination.pageItems.map((q) => (
              <tr key={q.id} className="align-top hover:bg-subtle/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{q.quote_number}</p>
                  {q.title ? <p className="text-fg/80">{q.title}</p> : null}
                  <p className="text-xs text-fg/55">{subline(q)}</p>
                  <p className="mt-1 text-xs text-fg/45">
                    {(q.quotation_items || []).length} lines
                  </p>
                </td>
                <td className="px-4 py-3 text-fg/80">
                  <p>
                    {Number(q.total).toFixed(2)} {q.currency}
                  </p>
                  <p className="text-xs text-fg/50">
                    {q.valid_until ? `Valid until ${q.valid_until}` : "No expiry date"}
                  </p>
                </td>
                <td className="px-4 py-3">{statusCell(q)}</td>
                <td className="px-4 py-3">{actions(q)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls pagination={pagination} />
      </div>
    </>
  );
}
