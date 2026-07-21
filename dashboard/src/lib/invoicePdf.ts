"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Invoice, InvoiceItem } from "@/lib/types";

type InvoiceWithItems = Invoice & { invoice_items?: InvoiceItem[] };

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const type = url.toLowerCase().includes(".png") ? "png" : "jpg";
    return { bytes: buf, type };
  } catch {
    return null;
  }
}

export async function downloadInvoicePdf(
  invoice: InvoiceWithItems,
  logoUrl?: string | null,
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.12, 0.27);
  const muted = rgb(0.35, 0.4, 0.48);

  let y = 790;
  let headerX = 50;

  if (logoUrl) {
    const image = await fetchImageBytes(logoUrl);
    if (image) {
      const embedded =
        image.type === "png"
          ? await doc.embedPng(image.bytes)
          : await doc.embedJpg(image.bytes);
      const dims = embedded.scale(0.35);
      page.drawImage(embedded, {
        x: 50,
        y: y - dims.height + 10,
        width: dims.width,
        height: dims.height,
      });
      headerX = 50 + dims.width + 16;
    }
  }

  page.drawText("INVOICE", { x: headerX, y, size: 28, font: bold, color: navy });
  y -= 40;

  page.drawText(`Invoice #: ${invoice.invoice_number}`, { x: 50, y, size: 11, font, color: muted });
  y -= 16;
  page.drawText(`Status: ${invoice.status}`, { x: 50, y, size: 11, font, color: muted });
  y -= 16;
  if (invoice.due_date) {
    page.drawText(`Due: ${invoice.due_date}`, { x: 50, y, size: 11, font, color: muted });
    y -= 16;
  }

  y -= 12;
  page.drawText("Bill To", { x: 50, y, size: 12, font: bold, color: navy });
  y -= 18;
  page.drawText(invoice.client_name, { x: 50, y, size: 12, font, color: navy });
  y -= 16;
  if (invoice.client_email) {
    page.drawText(invoice.client_email, { x: 50, y, size: 11, font, color: muted });
    y -= 16;
  }
  if (invoice.client_address) {
    page.drawText(invoice.client_address, { x: 50, y, size: 11, font, color: muted });
    y -= 16;
  }

  y -= 20;
  page.drawText("Description", { x: 50, y, size: 11, font: bold, color: navy });
  page.drawText("Qty", { x: 320, y, size: 11, font: bold, color: navy });
  page.drawText("Price", { x: 380, y, size: 11, font: bold, color: navy });
  page.drawText("Amount", { x: 470, y, size: 11, font: bold, color: navy });
  y -= 8;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 20;

  const items = invoice.invoice_items ?? [];
  for (const item of items) {
    const desc = (item.description || "").slice(0, 42);
    page.drawText(desc, { x: 50, y, size: 10, font, color: navy });
    page.drawText(String(item.quantity), { x: 320, y, size: 10, font, color: muted });
    page.drawText(Number(item.unit_price).toFixed(2), {
      x: 380,
      y,
      size: 10,
      font,
      color: muted,
    });
    page.drawText(Number(item.amount).toFixed(2), {
      x: 470,
      y,
      size: 10,
      font,
      color: navy,
    });
    y -= 18;
    if (y < 120) break;
  }

  y -= 16;
  page.drawLine({
    start: { x: 350, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 22;

  const subtotal = Number(invoice.subtotal ?? invoice.total);
  const discountPct = Number(invoice.discount_percent || 0);
  const discountAmt = Number(invoice.discount_amount || 0);
  const taxPct = Number(invoice.tax_percent || 0);
  const discount =
    discountAmt > 0 ? discountAmt : subtotal * (discountPct / 100);

  if (discount > 0 || taxPct > 0) {
    page.drawText(`Subtotal`, { x: 350, y, size: 10, font, color: muted });
    page.drawText(subtotal.toFixed(2), { x: 470, y, size: 10, font, color: muted });
    y -= 16;
    if (discount > 0) {
      const discountLabel =
        discountAmt > 0 ? "Discount" : `Discount (${discountPct}%)`;
      page.drawText(discountLabel, { x: 350, y, size: 10, font, color: muted });
      page.drawText(`-${discount.toFixed(2)}`, { x: 470, y, size: 10, font, color: muted });
      y -= 16;
    }
    if (taxPct > 0) {
      const taxable = Math.max(0, subtotal - discount);
      const tax = taxable * (taxPct / 100);
      page.drawText(`${invoice.tax_label || "Tax"} (${taxPct}%)`, {
        x: 350,
        y,
        size: 10,
        font,
        color: muted,
      });
      page.drawText(tax.toFixed(2), { x: 470, y, size: 10, font, color: muted });
      y -= 16;
    }
  }

  page.drawText(`Total (${invoice.currency})`, {
    x: 350,
    y,
    size: 12,
    font: bold,
    color: navy,
  });
  page.drawText(Number(invoice.total).toFixed(2), {
    x: 470,
    y,
    size: 12,
    font: bold,
    color: navy,
  });

  if (invoice.notes) {
    y -= 40;
    page.drawText("Notes", { x: 50, y, size: 11, font: bold, color: navy });
    y -= 16;
    page.drawText(invoice.notes.slice(0, 90), { x: 50, y, size: 10, font, color: muted });
  }

  page.drawText("Thank you for your business.", {
    x: 50,
    y: 60,
    size: 10,
    font,
    color: muted,
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
