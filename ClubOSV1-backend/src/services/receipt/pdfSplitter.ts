/**
 * PDF Page Splitter
 *
 * Splits multi-page PDFs into individual single-page PDFs.
 * Used for bulk receipt uploads where each page is a separate receipt.
 */

import { PDFDocument } from 'pdf-lib';
import { logger } from '../../utils/logger';

export interface SplitPage {
  pageNumber: number;
  base64DataUrl: string;
}

/**
 * Split a multi-page PDF into individual single-page PDFs.
 * Returns array of base64 data URLs, one per page.
 * Single-page PDFs return as-is (array of 1).
 */
export async function splitPdfPages(base64DataUrl: string): Promise<SplitPage[]> {
  try {
    // Extract raw base64 from data URL
    const base64Match = base64DataUrl.match(/^data:application\/pdf;base64,(.+)$/);
    if (!base64Match) {
      // Not a data URL — return as single page
      return [{ pageNumber: 1, base64DataUrl }];
    }

    const pdfBytes = Buffer.from(base64Match[1], 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    // Single page — no splitting needed
    if (pageCount <= 1) {
      return [{ pageNumber: 1, base64DataUrl }];
    }

    logger.info(`Splitting ${pageCount}-page PDF into individual pages`);

    const pages: SplitPage[] = [];

    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF with just this page
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);

      const singlePageBytes = await singlePageDoc.save();
      const singlePageBase64 = Buffer.from(singlePageBytes).toString('base64');

      pages.push({
        pageNumber: i + 1,
        base64DataUrl: `data:application/pdf;base64,${singlePageBase64}`,
      });
    }

    logger.info(`Successfully split PDF into ${pages.length} pages`);
    return pages;
  } catch (error) {
    logger.error('PDF splitting failed, returning as single page:', error);
    // Fallback: treat entire PDF as one receipt
    return [{ pageNumber: 1, base64DataUrl }];
  }
}

/**
 * Check if a base64 data URL is a multi-page PDF.
 */
export async function getPdfPageCount(base64DataUrl: string): Promise<number> {
  try {
    const base64Match = base64DataUrl.match(/^data:application\/pdf;base64,(.+)$/);
    if (!base64Match) return 1;

    const pdfBytes = Buffer.from(base64Match[1], 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  } catch {
    return 1;
  }
}
