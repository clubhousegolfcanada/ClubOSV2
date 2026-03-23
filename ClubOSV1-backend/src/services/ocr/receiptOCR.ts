import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { config } from '../../utils/envValidator';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

// Receipt data structure
export interface ReceiptOCRResult {
  vendor: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  hstAmount: number | null;
  hstRegNumber: string | null;
  subtotal: number | null;
  purchaseDate: string | null;
  paymentMethod: string | null;
  lineItems: LineItem[];
  rawText: string;
  confidence: number;
  category?: string;
}

interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
}

/**
 * Process a receipt image using OpenAI Vision API
 * @param base64Image - Base64 encoded image data (including data URL prefix)
 * @returns Structured receipt data
 */
export async function processReceiptWithOCR(base64Image: string): Promise<ReceiptOCRResult> {
  try {
    logger.info('Starting receipt OCR processing');

    // Prepare the image for OpenAI (ensure it has the right format)
    let imageData = base64Image;
    const isPdf = imageData.startsWith('data:application/pdf');
    if (!isPdf && !imageData.startsWith('data:')) {
      // Add data URL prefix for raw base64 image data
      imageData = `data:image/jpeg;base64,${imageData}`;
    }

    const systemPrompt = `You are a Canadian receipt OCR specialist for a business in Nova Scotia.
Extract transaction data from receipts with high accuracy.

Return a JSON object with these fields:
- vendor: Store/company name (clean, properly capitalized)
- totalAmount: Final total in dollars (number, e.g. 156.78)
- taxAmount: Total tax amount in dollars (number)
- hstAmount: HST or GST/HST amount specifically, in dollars (number). NS HST is 15%. If the receipt shows "Tax" as a single line in Nova Scotia, that IS the HST amount.
- hstRegNumber: The vendor's HST/GST registration number (format: 123456789 RT0001 or similar). Look for "HST#", "GST/HST No.", "Business Number", "BN", or a 9-digit number followed by "RT" near tax information.
- subtotal: Subtotal before tax (number)
- purchaseDate: Date in YYYY-MM-DD format
- paymentMethod: Credit card type (Visa, Mastercard), debit, cash, etc.
- lineItems: Array of items, each with: description (string), quantity (number), unitPrice (number), totalPrice (number)
- category: Best category from this list ONLY: Supplies, Equipment, Services, Food, Office, Utilities, Fuel, Software, Advertising, Insurance, Rent, Maintenance, Professional Fees, Shipping, Other

RULES:
- Amounts are in CAD unless explicitly stated otherwise
- If a field cannot be determined with confidence, use null
- IGNORE: promotional text, survey codes, store hours, ads, cashier names
- For vendor name: use the business name, not the address or franchise ID
- For dates: prefer the transaction date over the print date
- For HST reg number: this is critical for tax purposes — search carefully`;

    // Build messages — both PDFs and images use image_url with data URL
    const userContent: any[] = [
      {
        type: "text",
        text: isPdf
          ? "Extract the transaction data from this receipt PDF. Return ONLY valid JSON."
          : "Extract the transaction data from this receipt. Return ONLY valid JSON."
      },
      {
        type: "image_url",
        image_url: {
          url: imageData,
          detail: "high"
        }
      }
    ];

    // Call OpenAI Vision API with 60s timeout
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userContent
        }
      ],
      max_tokens: 1000,
      temperature: 0.1 // Low temperature for consistent extraction
    }, { timeout: 60000 });

    const content = response.choices[0]?.message?.content || '{}';

    // Parse the JSON response
    let extractedData: any;
    try {
      // Detect refusal/inability responses before trying to parse
      const contentLower = content.toLowerCase();
      if (contentLower.includes("i'm unable to") || contentLower.includes("i cannot") ||
          contentLower.includes("unable to extract") || contentLower.includes("please provide")) {
        logger.warn('GPT-4o could not read the receipt image, returning empty result', {
          response: content.slice(0, 200)
        });
        extractedData = {};
      } else {
        // Clean up the response (remove markdown code blocks if present)
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extractedData = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      logger.warn('Failed to parse OCR response as JSON, falling back to regex extraction', {
        responsePreview: content.slice(0, 200)
      });
      // Try to extract key information using regex as fallback
      extractedData = extractBasicInfo(content);
    }

    // Safe parseFloat that returns null instead of NaN or Infinity
    const safeFloat = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const n = parseFloat(val);
      return isNaN(n) || !isFinite(n) ? null : n;
    };

    // Build the result with validation
    const result: ReceiptOCRResult = {
      vendor: extractedData.vendor || null,
      totalAmount: safeFloat(extractedData.totalAmount),
      taxAmount: safeFloat(extractedData.taxAmount),
      hstAmount: safeFloat(extractedData.hstAmount),
      hstRegNumber: extractedData.hstRegNumber || null,
      subtotal: safeFloat(extractedData.subtotal),
      purchaseDate: extractedData.purchaseDate || null,
      paymentMethod: extractedData.paymentMethod || null,
      lineItems: Array.isArray(extractedData.lineItems) ? extractedData.lineItems : [],
      rawText: content,
      confidence: calculateConfidence(extractedData),
      category: extractedData.category || categorizeByVendor(extractedData.vendor)
    };

    logger.info('Receipt OCR completed successfully', {
      vendor: result.vendor,
      amount: result.totalAmount,
      itemCount: result.lineItems.length,
      confidence: result.confidence
    });

    return result;

  } catch (error: any) {
    logger.error('Receipt OCR failed:', error);

    // Return empty result on error
    return {
      vendor: null,
      totalAmount: null,
      taxAmount: null,
      hstAmount: null,
      hstRegNumber: null,
      subtotal: null,
      purchaseDate: null,
      paymentMethod: null,
      lineItems: [],
      rawText: error.message || 'OCR processing failed',
      confidence: 0
    };
  }
}

/**
 * Fallback function to extract basic info using regex
 */
function extractBasicInfo(text: string): any {
  const result: any = {};

  // Try to find total amount
  const totalMatch = text.match(/total[:\s]+\$?([\d,]+\.?\d*)/i);
  if (totalMatch) {
    result.totalAmount = parseFloat(totalMatch[1].replace(',', ''));
  }

  // Try to find tax
  const taxMatch = text.match(/tax[:\s]+\$?([\d,]+\.?\d*)/i);
  if (taxMatch) {
    result.taxAmount = parseFloat(taxMatch[1].replace(',', ''));
  }

  // Try to find date (various formats)
  const dateMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) {
    result.purchaseDate = dateMatch[0];
  }

  // Try to find vendor (first line or after "store" keyword)
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    result.vendor = lines[0].trim();
  }

  return result;
}

/**
 * Calculate confidence score based on extracted fields
 */
function calculateConfidence(data: any): number {
  let score = 0;

  if (data.vendor) score += 20;
  if (data.totalAmount) score += 20;
  if (data.purchaseDate) score += 15;
  if (data.taxAmount || data.hstAmount) score += 10;
  if (data.hstRegNumber) score += 10;
  if (data.subtotal) score += 10;
  if (data.paymentMethod) score += 5;
  if (data.lineItems && data.lineItems.length > 0) score += 10;

  return Math.min(score, 100) / 100;
}

/**
 * Auto-categorize based on vendor name
 */
function categorizeByVendor(vendor: string | null): string {
  if (!vendor) return 'Other';

  const vendorLower = vendor.toLowerCase();

  // Common vendor categorizations
  if (vendorLower.includes('home depot') || vendorLower.includes('lowes') || vendorLower.includes('rona')) {
    return 'Supplies';
  }
  if (vendorLower.includes('best buy') || vendorLower.includes('apple') || vendorLower.includes('microsoft')) {
    return 'Equipment';
  }
  if (vendorLower.includes('staples') || vendorLower.includes('office')) {
    return 'Office';
  }
  if (vendorLower.includes('restaurant') || vendorLower.includes('pizza') || vendorLower.includes('coffee')) {
    return 'Food';
  }
  if (vendorLower.includes('gas') || vendorLower.includes('shell') || vendorLower.includes('esso')) {
    return 'Fuel';
  }
  if (vendorLower.includes('bell') || vendorLower.includes('rogers') || vendorLower.includes('telus')) {
    return 'Utilities';
  }

  return 'Other';
}

/**
 * Format OCR results for display in ResponseDisplaySimple
 */
export function formatOCRForDisplay(result: ReceiptOCRResult): string {
  const lines: string[] = [];

  // Header
  if (result.confidence > 0.7) {
    lines.push('✓ Receipt Scanned Successfully\n');
  } else if (result.confidence > 0.3) {
    lines.push('⚠️ Partial Receipt Data Extracted\n');
  } else {
    lines.push('❌ Receipt Scan Failed - Please Enter Manually\n');
    return lines.join('\n');
  }

  // Main details
  if (result.vendor) {
    lines.push(`**Vendor:** ${result.vendor}`);
  }

  if (result.totalAmount !== null) {
    lines.push(`**Total Amount:** $${result.totalAmount.toFixed(2)}`);
  }

  if (result.taxAmount !== null) {
    lines.push(`**Tax:** $${result.taxAmount.toFixed(2)}`);
  }

  if (result.hstAmount !== null) {
    lines.push(`**HST:** $${result.hstAmount.toFixed(2)}`);
  }

  if (result.hstRegNumber) {
    lines.push(`**HST Reg#:** ${result.hstRegNumber}`);
  }

  if (result.subtotal !== null) {
    lines.push(`**Subtotal:** $${result.subtotal.toFixed(2)}`);
  }

  if (result.purchaseDate) {
    // Format date nicely
    const date = new Date(result.purchaseDate);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    lines.push(`**Date:** ${formatted}`);
  }

  if (result.paymentMethod) {
    lines.push(`**Payment:** ${result.paymentMethod}`);
  }

  if (result.category) {
    lines.push(`**Category:** ${result.category}`);
  }

  // Line items
  if (result.lineItems && result.lineItems.length > 0) {
    lines.push('\n**Items Detected:**');
    result.lineItems.forEach(item => {
      const qty = item.quantity ? `(${item.quantity}) ` : '';
      const price = item.totalPrice ? `- $${item.totalPrice.toFixed(2)}` : '';
      lines.push(`• ${item.description} ${qty}${price}`);
    });
  }

  // Confidence indicator
  lines.push(`\n*OCR Confidence: ${Math.round(result.confidence * 100)}%*`);

  return lines.join('\n');
}

/**
 * Detect and extract multiple receipts from a single image.
 * Returns array of ReceiptOCRResult (1 per receipt found).
 * Falls back to single-receipt extraction if multi-detection fails.
 */
export async function processMultiReceiptImage(base64Image: string): Promise<ReceiptOCRResult[]> {
  try {
    let imageData = base64Image;
    if (!imageData.startsWith('data:')) {
      imageData = `data:image/jpeg;base64,${imageData}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a Canadian receipt OCR specialist for a business in Nova Scotia.
This image may contain MULTIPLE receipts (e.g., several receipts photographed together, or a collage).

Count how many separate receipts are visible, then extract data from EACH one.

Return a JSON ARRAY of objects. Each object has:
- vendor, totalAmount, taxAmount, hstAmount, hstRegNumber, subtotal,
  purchaseDate (YYYY-MM-DD), paymentMethod, category, lineItems[]

Categories: Supplies, Equipment, Services, Food, Office, Utilities, Fuel, Software, Advertising, Insurance, Rent, Maintenance, Professional Fees, Shipping, Other

RULES:
- If only 1 receipt is visible, return an array with 1 object
- Amounts in CAD, null if unknown
- NS HST is 15%. Single "Tax" line = HST.
- CRITICAL: purchaseDate must be the actual date on the receipt, not today's date
- For dates that look like 2003 but context suggests 2023 (e.g., recent vendor, modern receipt format), use the more likely year`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "How many receipts are in this image? Extract data from each one. Return ONLY a valid JSON array." },
            { type: "image_url", image_url: { url: imageData, detail: "high" } }
          ]
        }
      ],
      max_tokens: 3000,
      temperature: 0.1
    }, { timeout: 90000 });

    const content = response.choices[0]?.message?.content || '[]';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.warn('Multi-receipt parse failed, falling back to single extraction');
      const single = await processReceiptWithOCR(base64Image);
      return [single];
    }

    // Normalize: if GPT returned a single object instead of array, wrap it
    const receiptsArray = Array.isArray(parsed) ? parsed : [parsed];

    if (receiptsArray.length === 0) {
      const single = await processReceiptWithOCR(base64Image);
      return [single];
    }

    const safeFloat = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const n = parseFloat(val);
      return isNaN(n) || !isFinite(n) ? null : n;
    };

    const results: ReceiptOCRResult[] = receiptsArray.map((item: any) => ({
      vendor: item.vendor || null,
      totalAmount: safeFloat(item.totalAmount),
      taxAmount: safeFloat(item.taxAmount),
      hstAmount: safeFloat(item.hstAmount),
      hstRegNumber: item.hstRegNumber || null,
      subtotal: safeFloat(item.subtotal),
      purchaseDate: item.purchaseDate || null,
      paymentMethod: item.paymentMethod || null,
      lineItems: Array.isArray(item.lineItems) ? item.lineItems : [],
      rawText: content,
      confidence: calculateConfidence(item),
      category: item.category || categorizeByVendor(item.vendor)
    }));

    logger.info(`Multi-receipt detection: found ${results.length} receipt(s)`);
    return results;

  } catch (error: any) {
    logger.error('Multi-receipt detection failed, falling back to single:', error);
    const single = await processReceiptWithOCR(base64Image);
    return [single];
  }
}