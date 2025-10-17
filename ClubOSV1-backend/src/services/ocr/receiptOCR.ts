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
    if (!imageData.startsWith('data:image')) {
      // Add data URL prefix if missing
      imageData = `data:image/jpeg;base64,${imageData}`;
    }

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a receipt OCR specialist. Extract ONLY transaction data from receipts.

          Return a JSON object with these fields:
          - vendor: Store/company name
          - totalAmount: Final total in dollars (number)
          - taxAmount: Tax amount in dollars (number)
          - subtotal: Subtotal before tax (number)
          - purchaseDate: Date in YYYY-MM-DD format
          - paymentMethod: Credit card, cash, debit, etc.
          - lineItems: Array of items with description, quantity, and totalPrice
          - category: Best category (Supplies, Equipment, Services, Food, Office, Utilities, Other)

          IGNORE: promotional text, survey codes, store hours, ads, cashier names, store numbers.
          If a field cannot be determined, use null.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the transaction data from this receipt. Return ONLY valid JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1 // Low temperature for consistent extraction
    });

    const content = response.choices[0]?.message?.content || '{}';

    // Parse the JSON response
    let extractedData: any;
    try {
      // Clean up the response (remove markdown code blocks if present)
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      logger.error('Failed to parse OCR response as JSON:', content);
      // Try to extract key information using regex as fallback
      extractedData = extractBasicInfo(content);
    }

    // Build the result with validation
    const result: ReceiptOCRResult = {
      vendor: extractedData.vendor || null,
      totalAmount: parseFloat(extractedData.totalAmount) || null,
      taxAmount: parseFloat(extractedData.taxAmount) || null,
      subtotal: parseFloat(extractedData.subtotal) || null,
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
  let fields = 0;

  // Check each important field
  if (data.vendor) { score += 20; fields++; }
  if (data.totalAmount) { score += 20; fields++; }
  if (data.purchaseDate) { score += 15; fields++; }
  if (data.taxAmount) { score += 10; fields++; }
  if (data.subtotal) { score += 10; fields++; }
  if (data.paymentMethod) { score += 10; fields++; }
  if (data.lineItems && data.lineItems.length > 0) { score += 15; fields++; }

  // Return percentage
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
    return 'Transportation';
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