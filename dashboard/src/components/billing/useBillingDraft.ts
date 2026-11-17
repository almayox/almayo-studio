"use client";

import { useMemo, useState } from "react";
import { toLineDrafts, toLineItems, type LineDraft } from "@/lib/lineItems";
import { computeTotals, round2, type DiscountMode } from "@/lib/totals";

/** The pricing columns invoices and quotations have in common. */
type PricedDocument = {
  currency?: string | null;
  discount_percent?: string | number | null;
  discount_amount?: string | number | null;
  tax_percent?: string | number | null;
  tax_label?: string | null;
};

type StoredLines = Parameters<typeof toLineDrafts>[0];

/** A stored number as form text; nothing or zero shows as an empty field. */
function positiveText(value: string | number | null | undefined) {
  return value != null && Number(value) > 0 ? String(value) : "";
}

/**
 * Form state for the priced part of an invoice or quotation: line items,
 * discount, tax and currency. `items` and `totals` are the single source for
 * both the on-screen preview and what gets saved.
 */
export function useBillingDraft(source?: PricedDocument | null, storedLines?: StoredLines) {
  const [lines, setLines] = useState<LineDraft[]>(() => toLineDrafts(storedLines));
  const [currency, setCurrency] = useState(source?.currency || "KWD");
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    Number(source?.discount_amount) > 0 ? "amount" : "percent",
  );
  const [discountPercent, setDiscountPercent] = useState(positiveText(source?.discount_percent));
  const [discountAmount, setDiscountAmount] = useState(positiveText(source?.discount_amount));
  const [taxPercent, setTaxPercent] = useState(positiveText(source?.tax_percent));
  const [taxLabel, setTaxLabel] = useState(source?.tax_label || "Tax");

  const { items, totals } = useMemo(() => {
    const rows = toLineItems(lines);
    return {
      items: rows,
      totals: computeTotals({
        lines: rows,
        discountMode,
        discountValue: discountMode === "percent" ? discountPercent : discountAmount,
        taxPercent,
      }),
    };
  }, [lines, discountPercent, discountAmount, discountMode, taxPercent]);

  /** The pricing columns as they are written to the database. */
  const pricing = {
    currency,
    subtotal: totals.subtotal,
    discount_percent:
      discountMode === "percent" && discountPercent !== "" ? Number(discountPercent) : null,
    discount_amount:
      discountMode === "amount" && discountAmount !== "" ? round2(Number(discountAmount)) : null,
    tax_percent: taxPercent === "" ? null : Number(taxPercent),
    tax_label: taxLabel || null,
    total: totals.total,
  };

  return {
    lines,
    setLines,
    currency,
    setCurrency,
    discountMode,
    setDiscountMode,
    discountPercent,
    setDiscountPercent,
    discountAmount,
    setDiscountAmount,
    taxPercent,
    setTaxPercent,
    taxLabel,
    setTaxLabel,
    items,
    totals,
    pricing,
  };
}

export type BillingDraft = ReturnType<typeof useBillingDraft>;
