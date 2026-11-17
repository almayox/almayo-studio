"use client";

import { fieldClass, labelClass } from "@/components/ui/PageChrome";
import type { DiscountMode } from "@/lib/totals";
import type { BillingDraft } from "@/components/billing/useBillingDraft";

const CURRENCIES = ["KWD", "USD", "EUR", "ETB", "PLN"];

/** Discount, tax and currency fields of an invoice or quotation. */
export function PricingFields({ draft }: { draft: BillingDraft }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className={`${labelClass} col-span-2 sm:col-span-4`}>
        Discount type
        <select
          value={draft.discountMode}
          onChange={(e) => draft.setDiscountMode(e.target.value as DiscountMode)}
          className={fieldClass}
        >
          <option value="percent">Percentage (%)</option>
          <option value="amount">Fixed amount</option>
        </select>
      </label>
      {draft.discountMode === "percent" ? (
        <label className={labelClass}>
          Discount %
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={draft.discountPercent}
            onChange={(e) => draft.setDiscountPercent(e.target.value)}
            className={fieldClass}
          />
        </label>
      ) : (
        <label className={labelClass}>
          Discount amount
          <input
            type="number"
            min="0"
            step="0.001"
            value={draft.discountAmount}
            onChange={(e) => draft.setDiscountAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
      )}
      <label className={labelClass}>
        Tax %
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.taxPercent}
          onChange={(e) => draft.setTaxPercent(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Tax label
        <input
          value={draft.taxLabel}
          onChange={(e) => draft.setTaxLabel(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Currency
        <select
          value={draft.currency}
          onChange={(e) => draft.setCurrency(e.target.value)}
          className={fieldClass}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
