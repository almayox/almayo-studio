/**
 * Shared money maths for invoices and quotations.
 * Pure functions only: the on-screen preview, the saved row and the PDF must
 * all go through here so they can never disagree.
 */

export type DiscountMode = "percent" | "amount";

export type TotalsLine = {
  quantity: number | string;
  unit_price: number | string;
};

export type TotalsInput = {
  lines: TotalsLine[];
  /** "percent": discountValue is a percentage; "amount": a fixed amount. */
  discountMode: DiscountMode;
  discountValue: number | string | null | undefined;
  taxPercent: number | string | null | undefined;
};

export type Totals = {
  subtotal: number;
  discount: number;
  /** Subtotal after discount, before tax. */
  taxable: number;
  tax: number;
  total: number;
};

/** Round to 2 decimals (half away from zero), tolerant of float noise. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Amount of one line (quantity × unit price), rounded to 2 decimals. */
export function lineAmount(line: TotalsLine): number {
  return round2(toNumber(line.quantity) * toNumber(line.unit_price));
}

/** Discount, tax and total for an already known subtotal. */
export function computeTotalsFromSubtotal(
  subtotalValue: number | string,
  discountMode: DiscountMode,
  discountValue: number | string | null | undefined,
  taxPercent: number | string | null | undefined,
): Totals {
  const subtotal = round2(toNumber(subtotalValue));
  const rawDiscount = Math.max(0, toNumber(discountValue));
  const discount = round2(
    Math.min(
      Math.max(0, subtotal),
      discountMode === "percent" ? subtotal * (rawDiscount / 100) : rawDiscount,
    ),
  );
  const taxable = round2(Math.max(0, subtotal - discount));
  const tax = round2(taxable * (Math.max(0, toNumber(taxPercent)) / 100));
  return { subtotal, discount, taxable, tax, total: round2(taxable + tax) };
}

/** Subtotal, discount (percent OR fixed amount), tax and total, all rounded to 2 decimals. */
export function computeTotals(input: TotalsInput): Totals {
  const subtotal = input.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  return computeTotalsFromSubtotal(
    subtotal,
    input.discountMode,
    input.discountValue,
    input.taxPercent,
  );
}

/**
 * Discount mode/value of a stored document row, which keeps the two modes in
 * separate columns (a fixed amount wins when both are set).
 */
export function storedDiscount(row: {
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
}): { discountMode: DiscountMode; discountValue: number } {
  const amount = toNumber(row.discount_amount);
  if (amount > 0) return { discountMode: "amount", discountValue: amount };
  return { discountMode: "percent", discountValue: toNumber(row.discount_percent) };
}
