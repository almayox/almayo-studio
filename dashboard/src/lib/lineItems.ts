/**
 * Line items shared by invoices and quotations: the editable drafts in the
 * form and the rows as they are stored.
 */
import { lineAmount, round2 } from "@/lib/totals";

/** One line as typed in the form (everything is text until it is saved). */
export type LineDraft = { description: string; quantity: string; unit_price: string };

type StoredLine = {
  description: string;
  quantity: string | number;
  unit_price: string | number;
  sort_order: number;
};

export const emptyLine = (): LineDraft => ({
  description: "",
  quantity: "1",
  unit_price: "",
});

/** Line drafts → rows as they are stored (2-decimal precision, like the database). */
export function toLineItems(lines: LineDraft[]) {
  return lines.map((line, index) => {
    const quantity = Number(line.quantity) > 0 ? round2(Number(line.quantity)) : 1;
    const unit_price = round2(Number(line.unit_price) || 0);
    return {
      description: line.description.trim(),
      quantity,
      unit_price,
      amount: lineAmount({ quantity, unit_price }),
      sort_order: index,
    };
  });
}

export type LineItemRow = ReturnType<typeof toLineItems>[number];

export function bySortOrder<T extends { sort_order: number }>(rows: T[] | null | undefined): T[] {
  return (rows || []).slice().sort((a, b) => a.sort_order - b.sort_order);
}

/** Stored rows → drafts for the form; a document without lines gets one empty line. */
export function toLineDrafts(rows: StoredLine[] | null | undefined): LineDraft[] {
  const items = bySortOrder(rows);
  if (!items.length) return [emptyLine()];
  return items.map((item) => ({
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
  }));
}

/** First problem that stops a document from being saved, or null. */
export function lineItemsProblem(items: LineItemRow[]): string | null {
  if (!items.length) return "Add at least one line item.";
  if (items.some((item) => !item.description)) return "Every line item needs a description.";
  if (items.some((item) => item.unit_price < 0)) return "Unit price cannot be negative.";
  return null;
}
