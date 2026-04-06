import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { logger } from '../../utils/logger';

// Receipt images don't need full phone camera resolution.
// 1400px wide at 85% JPEG quality is crisp and readable, drops
// a typical 3-5MB phone photo down to 200-400KB.
const MAX_WIDTH = 1400;
const MAX_HEIGHT = 1800;
const JPEG_QUALITY = 85;

/**
 * Compress a base64 image (JPEG/PNG) using sharp.
 * Resizes to MAX_WIDTH/MAX_HEIGHT if larger, converts to JPEG at JPEG_QUALITY.
 * Returns a smaller base64 JPEG buffer.
 */
async function compressImage(rawBase64: string): Promise<Buffer> {
  const imgBuffer = Buffer.from(rawBase64, 'base64');

  const compressed = await sharp(imgBuffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',       // Scale down to fit, never scale up
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const savings = imgBuffer.length - compressed.length;
  if (savings > 0) {
    logger.info(`Image compressed: ${(imgBuffer.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (saved ${(savings / 1024).toFixed(0)}KB)`);
  }

  return compressed;
}

/**
 * Convert a base64-encoded JPEG/PNG image to a single-page PDF.
 * Returns the PDF as a base64 data URL string.
 *
 * The image is resized and compressed before embedding to keep
 * PDF sizes small enough to email to accountants (~200-400KB typical).
 */
export async function convertImageToPdf(base64Image: string): Promise<string> {
  // Strip data URL prefix to get raw base64
  let rawBase64 = base64Image;
  if (base64Image.includes(',')) {
    const parts = base64Image.split(',');
    rawBase64 = parts[1];
  }

  // Compress the image first
  const compressedBuffer = await compressImage(rawBase64);

  return new Promise((resolve, reject) => {
    try {
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

      // Add the compressed image, fitting within the usable area
      doc.image(compressedBuffer, 36, 36, {
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
