import { PDFDocument } from "pdf-lib";

const IMAGE_MIME = /^image\//;
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?)$/i;

export interface PageInfo {
  pages: number;
  convertPending: boolean;
}

// Count pages for a single file buffer.
// - PDF: exact, via pdf-lib.
// - Image: 1 page.
// - Office (docx/xlsx/pptx): needs server-side LibreOffice conversion which is
//   deferred in this build. We flag convertPending and fall back to an estimate
//   so the queue still works; the operator sees a clear "conversion pending" tag.
export async function countPages(
  buf: Buffer,
  name: string,
  mime: string
): Promise<PageInfo> {
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name);
  if (isPdf) {
    try {
      const doc = await PDFDocument.load(buf, { updateMetadata: false });
      return { pages: doc.getPageCount(), convertPending: false };
    } catch {
      return { pages: 1, convertPending: false };
    }
  }
  if (IMAGE_MIME.test(mime) || /\.(jpe?g|png|heic|webp)$/i.test(name)) {
    return { pages: 1, convertPending: false };
  }
  if (OFFICE_EXT.test(name)) {
    // Rough estimate until real conversion is wired up. ~3 KB per page of text.
    const est = Math.max(1, Math.round(buf.length / 3000));
    return { pages: est, convertPending: true };
  }
  return { pages: 1, convertPending: false };
}

// Parse a page range like "3-7, 12" and return how many pages it selects,
// clamped to totalPages. Empty/invalid range => all pages.
export function pagesInRange(range: string | undefined, totalPages: number): number {
  if (!range || !range.trim()) return totalPages;
  const selected = new Set<number>();
  for (const partRaw of range.split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= totalPages) selected.add(i);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= totalPages) selected.add(n);
    }
  }
  return selected.size > 0 ? selected.size : totalPages;
}
