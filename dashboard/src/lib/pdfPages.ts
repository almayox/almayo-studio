/**
 * Turns a PDF into page images in the browser, so the public site can show it
 * as a book without loading a PDF reader. The PDF itself is never uploaded,
 * which also means its file size does not matter.
 */

export type PdfPage = { url: string; width: number; height: number };

/** Long edge of a page image: sharp on a large screen, still a small file. */
const PAGE_MAX_EDGE = 1800;
const PAGE_QUALITY = 0.86;
const MAX_PAGES = 120;

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** Renders every page to a WebP file, in order, and says whether the text reads right to left. */
export async function pdfToPageImages(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<{ pages: { file: File; width: number; height: number }[]; rtl: boolean }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    throw new Error("This PDF could not be read. If it has a password, remove it and try again.");
  }

  try {
    if (doc.numPages > MAX_PAGES) {
      throw new Error(`This PDF has ${doc.numPages} pages; the most a book can hold is ${MAX_PAGES}.`);
    }
    const pages: { file: File; width: number; height: number }[] = [];
    // Arabic against Latin letters in the first pages decides which way the book opens.
    let arabic = 0;
    let latin = 0;
    for (let number = 1; number <= doc.numPages; number += 1) {
      onPage?.(number - 1, doc.numPages);
      const page = await doc.getPage(number);
      if (number <= 5) {
        const text = await page.getTextContent().catch(() => null);
        for (const item of text?.items ?? []) {
          const value = "str" in item ? item.str : "";
          arabic += (value.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
          latin += (value.match(/[A-Za-z]/g) || []).length;
        }
      }
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(3, PAGE_MAX_EDGE / Math.max(natural.width, natural.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // White behind the page, as on paper; PDFs often have no background.
      // "print" renders straight through instead of waiting on screen refreshes,
      // so it keeps going when the tab is in the background.
      await page.render({ canvas, viewport, background: "#ffffff", intent: "print" }).promise;
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/webp", PAGE_QUALITY),
      );
      page.cleanup();
      if (!blob) throw new Error(`Page ${number} of the PDF could not be prepared.`);
      pages.push({
        file: new File([blob], `page-${String(number).padStart(3, "0")}.webp`, { type: blob.type }),
        width: canvas.width,
        height: canvas.height,
      });
      canvas.width = 0;
      canvas.height = 0;
    }
    onPage?.(doc.numPages, doc.numPages);
    return { pages, rtl: arabic > latin };
  } finally {
    await task.destroy();
  }
}
