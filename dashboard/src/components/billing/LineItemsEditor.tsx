"use client";

import { emptyLine, type LineDraft } from "@/lib/lineItems";
import type { BillingDraft } from "@/components/billing/useBillingDraft";

const lineInputClass = "rounded-lg border border-line bg-subtle px-3 py-2 text-sm outline-none";

/** Line items of an invoice or quotation, with the running totals below them. */
export function LineItemsEditor({ draft }: { draft: BillingDraft }) {
  const { lines, setLines, totals, currency, taxPercent, taxLabel } = draft;

  function change(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)));
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-subtle/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/50">Line items</p>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="text-xs font-medium text-fg underline"
        >
          + Add line
        </button>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="space-y-2 rounded-lg bg-surface p-2 ring-1 ring-line">
          <input
            required
            placeholder="Description"
            value={line.description}
            onChange={(e) => change(index, { description: e.target.value })}
            className={`w-full ${lineInputClass}`}
          />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              type="number"
              min="1"
              step="0.01"
              value={line.quantity}
              onChange={(e) => change(index, { quantity: e.target.value })}
              className={lineInputClass}
              placeholder="Qty"
            />
            <input
              required
              type="number"
              step="0.001"
              value={line.unit_price}
              onChange={(e) => change(index, { unit_price: e.target.value })}
              className={lineInputClass}
              placeholder="Price"
            />
            <button
              type="button"
              aria-label="Remove line"
              onClick={() => removeLine(index)}
              className="px-2 text-xs text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <div className="space-y-0.5 text-sm text-fg">
        <p>
          Subtotal: {totals.subtotal.toFixed(2)} {currency}
        </p>
        {totals.discount > 0 ? (
          <p className="text-fg/60">Discount: −{totals.discount.toFixed(2)}</p>
        ) : null}
        {Number(taxPercent) > 0 ? (
          <p className="text-fg/60">
            {taxLabel || "Tax"}: {totals.tax.toFixed(2)}
          </p>
        ) : null}
        <p className="font-semibold">
          Total: {totals.total.toFixed(2)} {currency}
        </p>
      </div>
    </div>
  );
}
