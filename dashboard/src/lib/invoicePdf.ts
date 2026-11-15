"use client";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Invoice, InvoiceItem, InvoicePayment } from "@/lib/types";
import { computeTotalsFromSubtotal, round2, storedDiscount } from "@/lib/totals";

export type InvoiceDocType = "invoice" | "quotation";

/**
 * Row shape the PDF needs. A quotation can reuse it by mapping its number to
 * `invoice_number`, its lines to `invoice_items` and setting `valid_until`.
 */
export type InvoicePdfSource = Invoice & {
  invoice_items?: InvoiceItem[];
  invoice_payments?: Pick<InvoicePayment, "amount">[];
  /** Quotations only; falls back to `due_date` when missing. */
  valid_until?: string | null;
};

/** Thrown when the text contains characters the built-in PDF font cannot encode (e.g. Arabic). */
export class PdfUnsupportedTextError extends Error {
  constructor(message = "This PDF font cannot render Arabic text yet") {
    super(message);
    this.name = "PdfUnsupportedTextError";
  }
}

const PAGE_SIZE: [number, number] = [595, 842];
const LEFT = 50;
const RIGHT = 545;
const TOP = 790;
const BOTTOM = 90;
const FOOTER_Y = 60;
const COL_QTY = 320;
const COL_PRICE = 380;
const COL_AMOUNT = 470;
const TOTALS_X = 350;
const LOGO_MAX_WIDTH = 150;
const LOGO_MAX_HEIGHT = 50;
const LOGO_MAX_PIXELS = 800;

/**
 * Loads the logo and re-encodes it as PNG through a canvas, because pdf-lib can
 * only embed PNG/JPEG (logos are often WebP). Returns null on any failure so
 * the document is simply generated without a logo.
 */
async function loadLogoAsPng(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const objectUrl = URL.createObjectURL(await res.blob());
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Logo could not be decoded"));
        el.src = objectUrl;
      });
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) return null;
      const scale = Math.min(1, LOGO_MAX_PIXELS / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) return null;
      return new Uint8Array(await png.arrayBuffer());
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Tabs become spaces and other control characters are dropped; line breaks are kept. */
function clean(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");
}

/** Splits text into lines no wider than maxWidth, honouring explicit line breaks. */
function wrapText(value: string | null | undefined, font: PDFFont, size: number, maxWidth: number) {
  const fits = (text: string) => font.widthOfTextAtSize(text, size) <= maxWidth;
  const lines: string[] = [];
  for (const paragraph of clean(value).split("\n")) {
    let current = "";
    for (const word of paragraph.split(" ").filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      // A single word wider than the column is broken across lines.
      let rest = word;
      while (rest && !fits(rest)) {
        let cut = Math.max(1, rest.length - 1);
        while (cut > 1 && !fits(rest.slice(0, cut))) cut -= 1;
        if (cut >= rest.length) break;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    lines.push(current);
  }
  return lines;
}

function isEncodingError(err: unknown) {
  return err instanceof Error && /cannot encode/i.test(err.message);
}

/**
 * Builds and downloads the PDF.
 *
 * @param logoUrl  A URL the browser can fetch (sign private storage URLs first).
 * @param docType  "invoice" (default) or "quotation": changes the title, prints
 *                 "Valid until" instead of the due date and omits payment lines.
 * @throws PdfUnsupportedTextError when the text cannot be encoded by the font.
 */
export async function downloadInvoicePdf(
  invoice: InvoicePdfSource,
  logoUrl?: string | null,
  docType: InvoiceDocType = "invoice",
) {
  let bytes: Uint8Array;
  try {
    bytes = await buildPdf(invoice, logoUrl, docType);
  } catch (err) {
    if (isEncodingError(err)) throw new PdfUnsupportedTextError();
    throw err;
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function buildPdf(
  invoice: InvoicePdfSource,
  logoUrl: string | null | undefined,
  docType: InvoiceDocType,
): Promise<Uint8Array> {
  const isQuotation = docType === "quotation";
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.12, 0.27);
  const muted = rgb(0.35, 0.4, 0.48);
  const rule = rgb(0.85, 0.88, 0.92);

  let page = doc.addPage(PAGE_SIZE);
  let y = TOP;

  const newPage = () => {
    page = doc.addPage(PAGE_SIZE);
    y = TOP;
  };
  /** Starts a new page when `needed` points do not fit above the footer. */
  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM) {
      newPage();
      return true;
    }
    return false;
  };
  const draw = (
    text: string,
    x: number,
    options: { size?: number; bold?: boolean; muted?: boolean } = {},
  ) => {
    page.drawText(clean(text).replace(/\n/g, " "), {
      x,
      y,
      size: options.size ?? 10,
      font: options.bold ? bold : font,
      color: options.muted ? muted : navy,
    });
  };

  // Header: optional logo + title
  let headerX = LEFT;
  let logoHeight = 0;
  if (logoUrl) {
    try {
      const png = await loadLogoAsPng(logoUrl);
      if (png) {
        const embedded = await doc.embedPng(png);
        const scale = Math.min(
          LOGO_MAX_WIDTH / embedded.width,
          LOGO_MAX_HEIGHT / embedded.height,
          1,
        );
        const width = embedded.width * scale;
        logoHeight = embedded.height * scale;
        page.drawImage(embedded, {
          x: LEFT,
          y: y - logoHeight + 22,
          width,
          height: logoHeight,
        });
        headerX = LEFT + width + 16;
      }
    } catch {
      // Any logo problem: carry on without it.
      headerX = LEFT;
      logoHeight = 0;
    }
  }

  draw(isQuotation ? "QUOTATION" : "INVOICE", headerX, { size: 28, bold: true });
  y -= Math.max(40, logoHeight);

  draw(`${isQuotation ? "Quotation" : "Invoice"} #: ${invoice.invoice_number}`, LEFT, {
    size: 11,
    muted: true,
  });
  y -= 16;
  draw(`Status: ${invoice.status}`, LEFT, { size: 11, muted: true });
  y -= 16;
  if (isQuotation) {
    const validUntil = invoice.valid_until || invoice.due_date;
    if (validUntil) {
      draw(`Valid until: ${validUntil}`, LEFT, { size: 11, muted: true });
      y -= 16;
    }
  } else if (invoice.due_date) {
    draw(`Due: ${invoice.due_date}`, LEFT, { size: 11, muted: true });
    y -= 16;
  }

  y -= 12;
  draw(isQuotation ? "Prepared For" : "Bill To", LEFT, { size: 12, bold: true });
  y -= 18;
  for (const line of wrapText(invoice.client_name, font, 12, RIGHT - LEFT)) {
    draw(line, LEFT, { size: 12 });
    y -= 16;
  }
  if (invoice.client_email) {
    draw(invoice.client_email, LEFT, { size: 11, muted: true });
    y -= 16;
  }
  if (invoice.client_address) {
    for (const line of wrapText(invoice.client_address, font, 11, RIGHT - LEFT)) {
      draw(line, LEFT, { size: 11, muted: true });
      y -= 16;
    }
  }

  // Line items (the column header is repeated on every page)
  const drawTableHeader = () => {
    draw("Description", LEFT, { size: 11, bold: true });
    draw("Qty", COL_QTY, { size: 11, bold: true });
    draw("Price", COL_PRICE, { size: 11, bold: true });
    draw("Amount", COL_AMOUNT, { size: 11, bold: true });
    y -= 8;
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 1, color: rule });
    y -= 20;
  };

  y -= 20;
  ensureSpace(28 + 18);
  drawTableHeader();

  const items = (invoice.invoice_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const lineHeight = 13;
  for (const item of items) {
    const descLines = wrapText(item.description, font, 10, COL_QTY - LEFT - 12);
    const rowHeight = descLines.length * lineHeight + 5;
    if (ensureSpace(rowHeight)) drawTableHeader();

    draw(String(item.quantity), COL_QTY, { muted: true });
    draw(Number(item.unit_price).toFixed(2), COL_PRICE, { muted: true });
    draw(Number(item.amount).toFixed(2), COL_AMOUNT);
    for (const line of descLines) {
      draw(line, LEFT);
      y -= lineHeight;
    }
    y -= 5;
  }

  // Totals block (never split across pages)
  const subtotal = Number(invoice.subtotal ?? invoice.total) || 0;
  const taxPct = Number(invoice.tax_percent || 0);
  const { discountMode, discountValue } = storedDiscount(invoice);
  const totals = computeTotalsFromSubtotal(subtotal, discountMode, discountValue, taxPct);
  const total = Number(invoice.total) || 0;

  const payments = invoice.invoice_payments ?? [];
  const paid = round2(
    payments.length
      ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(invoice.amount_paid || 0),
  );
  const showPayments = !isQuotation && paid > 0;

  type TotalRow = { label: string; value: string; strong?: boolean };
  const rows: TotalRow[] = [];
  if (totals.discount > 0 || taxPct > 0) {
    rows.push({ label: "Subtotal", value: subtotal.toFixed(2) });
    if (totals.discount > 0) {
      rows.push({
        label: discountMode === "amount" ? "Discount" : `Discount (${discountValue}%)`,
        value: `-${totals.discount.toFixed(2)}`,
      });
    }
    if (taxPct > 0) {
      rows.push({
        label: `${invoice.tax_label || "Tax"} (${taxPct}%)`,
        value: totals.tax.toFixed(2),
      });
    }
  }
  rows.push({ label: `Total (${invoice.currency})`, value: total.toFixed(2), strong: true });
  if (showPayments) {
    rows.push({ label: "Paid", value: `-${paid.toFixed(2)}` });
    rows.push({
      label: `Balance due (${invoice.currency})`,
      value: Math.max(0, round2(total - paid)).toFixed(2),
      strong: true,
    });
  }

  const rowHeight = (row: TotalRow) => (row.strong ? 20 : 16);
  const totalsHeight = 16 + 22 + rows.reduce((sum, row) => sum + rowHeight(row), 0);
  ensureSpace(totalsHeight);

  y -= 16;
  page.drawLine({ start: { x: TOTALS_X, y }, end: { x: RIGHT, y }, thickness: 1, color: rule });
  y -= 22;
  for (const row of rows) {
    const size = row.strong ? 12 : 10;
    draw(row.label, TOTALS_X, { size, bold: row.strong, muted: !row.strong });
    draw(row.value, COL_AMOUNT, { size, bold: row.strong, muted: !row.strong });
    y -= rowHeight(row);
  }

  // Notes
  if (invoice.notes) {
    const noteLines = wrapText(invoice.notes, font, 10, RIGHT - LEFT);
    ensureSpace(24 + 16 + lineHeight);
    y -= 24;
    draw("Notes", LEFT, { size: 11, bold: true });
    y -= 16;
    for (const line of noteLines) {
      ensureSpace(lineHeight);
      draw(line, LEFT, { muted: true });
      y -= lineHeight;
    }
  }

  // Footer
  const pages = doc.getPages();
  pages[pages.length - 1].drawText("Thank you for your business.", {
    x: LEFT,
    y: FOOTER_Y,
    size: 10,
    font,
    color: muted,
  });
  if (pages.length > 1) {
    pages.forEach((p, index) => {
      const label = `Page ${index + 1} of ${pages.length}`;
      p.drawText(label, {
        x: RIGHT - font.widthOfTextAtSize(label, 9),
        y: FOOTER_Y,
        size: 9,
        font,
        color: muted,
      });
    });
  }

  return doc.save();
}
