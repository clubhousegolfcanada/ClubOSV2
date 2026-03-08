import PDFDocument from 'pdfkit';
import { logger } from '../../utils/logger';

/**
 * Convert a base64-encoded JPEG/PNG image to a single-page PDF.
 * Returns the PDF as a base64 data URL string.
 *
 * The image is centered on a letter-size page with margins.
 * Original image quality is preserved — no re-compression.
 */
export async function convertImageToPdf(base64Image: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Strip data URL prefix to get raw base64
      let rawBase64 = base64Image;
      if (base64Image.includes(',')) {
        const parts = base64Image.split(',');
        rawBase64 = parts[1];
      }

      const imgBuffer = Buffer.from(rawBase64, 'base64');

      // Create PDF document (letter size: 612 x 792 points)
      const doc = new PDFDocument({
        size: 'letter',
        margin: 36, // 0.5 inch margins
        info: {
          Title: 'Receipt',
          Producer: 'ClubOS Receipt System'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
        resolve(pdfBase64);
      });
      doc.on('error', reject);

      // Calculate image dimensions to fit within page margins
      // Page: 612x792, margins: 36 each side → usable: 540 x 720
      const maxWidth = 540;
      const maxHeight = 720;

      // Add the image, fitting within the usable area
      doc.image(imgBuffer, 36, 36, {
        fit: [maxWidth, maxHeight],
        align: 'center',
        valign: 'center'
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
