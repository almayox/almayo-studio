import {
  downloadInvoicePdf,
  PdfUnsupportedTextError,
  type InvoiceDocType,
  type InvoicePdfSource,
} from "@/lib/invoicePdf";
import { resolveStorageUrl } from "@/lib/storage";

/**
 * Downloads an invoice or quotation PDF.
 * Returns a message to show when it could not be generated, or null.
 */
export async function downloadDocumentPdf(
  source: InvoicePdfSource,
  logoUrl: string | null | undefined,
  docType: InvoiceDocType = "invoice",
): Promise<string | null> {
  try {
    // The logo may live in a private bucket: sign it first. A logo that
    // cannot be signed or loaded is simply left out of the PDF.
    let signedLogoUrl: string | null = null;
    try {
      signedLogoUrl = await resolveStorageUrl(logoUrl);
    } catch {
      signedLogoUrl = null;
    }
    await downloadInvoicePdf(source, signedLogoUrl, docType);
    return null;
  } catch (err) {
    return err instanceof PdfUnsupportedTextError
      ? "This PDF font cannot render Arabic text yet"
      : `Could not generate the PDF${err instanceof Error && err.message ? `: ${err.message}` : "."}`;
  }
}
