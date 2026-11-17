"use client";

import { FileText, History, Mail, Pencil, Trash2, Wallet } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionGroup, inlineSelectClass } from "@/components/ui/PageChrome";
import { PaginationControls, type Pagination } from "@/components/ui/Pagination";
import { INVOICE_STATUS_OPTIONS, type InvoiceRow } from "@/lib/invoices";

/** The invoices list: cards on phones, a table from tablet width up. */
export function InvoicesList({
  pagination,
  onEdit,
  onPdf,
  onEmail,
  onPayment,
  onHistory,
  onDelete,
  onStatusChange,
}: {
  pagination: Pagination<InvoiceRow>;
  onEdit: (invoice: InvoiceRow) => void;
  onPdf: (invoice: InvoiceRow) => void;
  onEmail: (invoice: InvoiceRow) => void;
  onPayment: (invoice: InvoiceRow) => void;
  onHistory: (invoice: InvoiceRow) => void;
  onDelete: (invoice: InvoiceRow) => void;
  onStatusChange: (invoice: InvoiceRow, status: string) => void;
}) {
  function statusSelect(invoice: InvoiceRow) {
    return (
      <select
        value={invoice.status}
        onChange={(e) => onStatusChange(invoice, e.target.value)}
        aria-label={`Status of ${invoice.invoice_number}`}
        className={inlineSelectClass}
      >
        {INVOICE_STATUS_OPTIONS.map((status) => (
          <option key={status.value} value={status.value}>
            {status.value}
          </option>
        ))}
      </select>
    );
  }

  function actions(invoice: InvoiceRow) {
    return (
      <ActionGroup>
        <ActionButton icon={Pencil} label="Edit" onClick={() => onEdit(invoice)} />
        <ActionButton icon={FileText} label="PDF" onClick={() => onPdf(invoice)} />
        <ActionButton icon={Mail} label="Email" onClick={() => onEmail(invoice)} />
        <ActionButton icon={Wallet} label="Payment" onClick={() => onPayment(invoice)} />
        <ActionButton icon={History} label="History" onClick={() => onHistory(invoice)} />
        <ActionButton icon={Trash2} label="Delete" danger onClick={() => onDelete(invoice)} />
      </ActionGroup>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface md:hidden">
        <div className="space-y-3 p-4">
          {pagination.pageItems.map((invoice) => (
            <article key={invoice.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">{invoice.invoice_number}</p>
                  <p className="text-xs text-fg/55">{invoice.client_name}</p>
                  {invoice.quotation_id ? (
                    <p className="text-xs text-fg/45">From quotation</p>
                  ) : null}
                </div>
                {statusSelect(invoice)}
              </div>
              <p className="mt-2 text-sm text-fg">
                {Number(invoice.total).toFixed(2)} {invoice.currency}
                <span className="text-fg/50">
                  {" "}
                  · paid {Number(invoice.amount_paid || 0).toFixed(2)}
                </span>
              </p>
              <div className="mt-3">{actions(invoice)}</div>
            </article>
          ))}
        </div>
        <PaginationControls pagination={pagination} />
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs uppercase tracking-wide text-fg/60">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Total / Paid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pagination.pageItems.map((invoice) => (
              <tr key={invoice.id} className="align-top hover:bg-subtle/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{invoice.invoice_number}</p>
                  <p className="text-xs text-fg/55">{invoice.client_name}</p>
                  <p className="mt-1 text-xs text-fg/45">
                    {invoice.quotation_id ? "From quotation · " : ""}
                    {(invoice.invoice_items || []).length} lines ·{" "}
                    {(invoice.invoice_payments || []).length} payments
                  </p>
                </td>
                <td className="px-4 py-3 text-fg/80">
                  <p>
                    {Number(invoice.total).toFixed(2)} {invoice.currency}
                  </p>
                  <p className="text-xs text-fg/50">
                    Paid {Number(invoice.amount_paid || 0).toFixed(2)}
                  </p>
                </td>
                <td className="px-4 py-3">{statusSelect(invoice)}</td>
                <td className="px-4 py-3">{actions(invoice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls pagination={pagination} />
      </div>
    </>
  );
}
