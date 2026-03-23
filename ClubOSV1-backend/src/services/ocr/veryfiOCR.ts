/**
 * Veryfi Receipt OCR Integration
 *
 * Uses Veryfi's purpose-built receipt/invoice API for higher accuracy
 * on line items, HST extraction, and vendor identification.
 *
 * Falls back to GPT-4o if Veryfi is not configured.
 *
 * Setup: Set VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME, VERYFI_API_KEY
 * in environment variables. Sign up at https://www.veryfi.com/
 */

import { logger } from '../../utils/logger';
import { ReceiptOCRResult, processReceiptWithOCR as gpt4oOCR } from './receiptOCR';

const VERYFI_API_URL = 'https://api.veryfi.com/api/v8/partner/documents';

interface VeryfiConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  apiKey: string;
}

function getVeryfiConfig(): VeryfiConfig | null {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const clientSecret = process.env.VERYFI_CLIENT_SECRET;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !clientSecret || !username || !apiKey) {
    return null;
  }

  return { clientId, clientSecret, username, apiKey };
}

/**
 * Process receipt with Veryfi API
 * Accepts base64 data URL (data:image/jpeg;base64,... or data:application/pdf;base64,...)
 */
async function processWithVeryfi(
  base64DataUrl: string,
  config: VeryfiConfig
): Promise<ReceiptOCRResult> {
  // Extract the raw base64 and mime type from data URL
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 data URL format');
  }

  const [, mimeType, base64Data] = match;

  // Determine file extension
  let fileExtension = 'jpg';
  if (mimeType.includes('pdf')) fileExtension = 'pdf';
  else if (mimeType.includes('png')) fileExtension = 'png';

  const body = JSON.stringify({
    file_data: base64Data,
    file_name: `receipt.${fileExtension}`,
    categories: [
      'Supplies', 'Equipment', 'Services', 'Food', 'Office',
      'Utilities', 'Fuel', 'Software', 'Advertising', 'Insurance',
      'Rent', 'Maintenance', 'Professional Fees', 'Shipping', 'Other'
    ],
    boost_mode: 1, // Higher accuracy
    parse_address: false, // Skip address parsing to save cost
  });

  const response = await fetch(VERYFI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'CLIENT-ID': config.clientId,
      'AUTHORIZATION': `apikey ${config.username}:${config.apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Veryfi API error ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();

  // Map Veryfi response to our ReceiptOCRResult format
  const lineItems = (data.line_items || []).map((item: any) => ({
    description: item.description || '',
    quantity: item.quantity || 1,
    unitPrice: item.price || null,
    totalPrice: item.total || 0,
  }));

  // Extract HST/GST info - Veryfi returns tax lines
  let hstAmount: number | null = null;
  let taxAmount: number | null = null;

  if (data.tax_lines && data.tax_lines.length > 0) {
    for (const taxLine of data.tax_lines) {
      const name = (taxLine.name || '').toLowerCase();
      if (name.includes('hst') || name.includes('gst')) {
        hstAmount = taxLine.total || null;
      }
      taxAmount = (taxAmount || 0) + (taxLine.total || 0);
    }
  }
  // Fallback to total tax field
  if (taxAmount === null) {
    taxAmount = data.tax || null;
  }
  // In Nova Scotia, if there's one tax line it's HST
  if (hstAmount === null && data.tax_lines?.length === 1) {
    hstAmount = taxAmount;
  }

  // Look for HST registration number in OCR text
  let hstRegNumber: string | null = null;
  const ocrText = data.ocr_text || '';
  const hstRegMatch = ocrText.match(/(?:HST|GST|BN|Business\s*(?:Number|No))[#:\s]*(\d{9}\s*RT\s*\d{4})/i)
    || ocrText.match(/(\d{9}\s*RT\s*\d{4})/i);
  if (hstRegMatch) {
    hstRegNumber = hstRegMatch[1].trim();
  }

  // Calculate confidence based on what Veryfi extracted
  let confidence = 0;
  if (data.vendor?.name) confidence += 20;
  if (data.total) confidence += 20;
  if (data.date) confidence += 15;
  if (taxAmount) confidence += 10;
  if (hstRegNumber) confidence += 10;
  if (data.subtotal) confidence += 10;
  if (data.payment?.type) confidence += 5;
  if (lineItems.length > 0) confidence += 10;

  const result: ReceiptOCRResult = {
    vendor: data.vendor?.name || null,
    totalAmount: data.total || null,
    taxAmount,
    hstAmount,
    hstRegNumber,
    subtotal: data.subtotal || null,
    purchaseDate: data.date || null,
    paymentMethod: data.payment?.type || null,
    lineItems,
    rawText: ocrText,
    confidence: Math.min(confidence, 100) / 100,
    category: data.category || undefined,
  };

  logger.info('Veryfi OCR completed', {
    vendor: result.vendor,
    amount: result.totalAmount,
    items: result.lineItems.length,
    confidence: result.confidence,
    veryfiId: data.id,
  });

  return result;
}

/**
 * Smart receipt OCR — uses Veryfi if configured, falls back to GPT-4o
 */
export async function processReceiptSmart(base64Image: string): Promise<ReceiptOCRResult> {
  const veryfiConfig = getVeryfiConfig();

  if (veryfiConfig) {
    try {
      return await processWithVeryfi(base64Image, veryfiConfig);
    } catch (error) {
      logger.error('Veryfi OCR failed, falling back to GPT-4o:', error);
      // Fall through to GPT-4o
    }
  }

  // Default: GPT-4o (already working, good enough for most receipts)
  return gpt4oOCR(base64Image);
}

/**
 * Check if Veryfi is configured
 */
export function isVeryfiConfigured(): boolean {
  return getVeryfiConfig() !== null;
}
