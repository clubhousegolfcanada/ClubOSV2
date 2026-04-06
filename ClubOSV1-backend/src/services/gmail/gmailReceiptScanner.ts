/**
 * Gmail Receipt Scanner
 *
 * Connects to Gmail via OAuth2, searches for receipt/invoice emails,
 * extracts PDF attachments and HTML body receipts, runs OCR,
 * and inserts into the receipts table.
 *
 * Idempotent: tracks processed message IDs in gmail_scanned_messages.
 * Non-blocking: runs on a schedule, never blocks the main server.
 */

import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import { processReceiptSmart } from '../ocr/veryfiOCR';
import { convertImageToPdf } from '../receipt/imageToPdf';
import { hash } from '../../utils/encryption';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

// --- Configuration ---

// Primary query: Gmail's built-in purchase category catches ~80% of receipts
// This is the single most important query — Gmail internally tags all purchase emails
const PRIMARY_QUERIES = [
  'category:purchases',
];

const VENDOR_QUERIES = [
  // Canadian retail & hardware
  'from:homedepot', 'from:bestbuy', 'from:amazon',
  'from:ikea', 'from:walmart', 'from:costco',
  'from:kent.ca', 'from:canadiantire', 'from:rona',
  'from:lowes', 'from:princessauto',
  // Canadian utilities & telecom
  'from:nspower', 'from:bellaliant', 'from:bell.ca',
  'from:eastlink', 'from:rogers', 'from:telus',
  'from:koodo', 'from:fido',
  // SaaS & tech (business expenses)
  'from:shopify', 'from:stripe', 'from:square',
  'from:anthropic', 'from:openai', 'from:hubspot',
  'from:railway.app', 'from:vercel', 'from:github',
  'from:digitalocean', 'from:godaddy', 'from:namecheap',
  'from:cloudflare', 'from:slack', 'from:zoom',
  'from:canva', 'from:adobe', 'from:microsoft',
  'from:google subject:payment', 'from:apple subject:receipt',
  'from:intuit', 'from:freshbooks', 'from:xero',
  // Office & supplies
  'from:staples', 'from:vistaprint',
  // Fuel & auto
  'from:petro-canada', 'from:ultramar', 'from:shell',
  'from:esso', 'from:irving',
  // Transport & delivery
  'from:uber', 'from:lyft', 'from:doordash',
  'from:skipthedishes', 'from:airbnb',
  // Insurance & finance
  'from:td.com', 'from:rbc.com', 'from:scotiabank',
  'from:manulife', 'from:sunlife',
];

const KEYWORD_QUERIES = [
  'subject:receipt', 'subject:invoice', 'subject:"order confirmation"',
  'subject:"payment confirmation"', 'subject:"your order"',
  'subject:"purchase confirmation"', 'subject:"billing statement"',
  'subject:"payment received"', 'subject:"transaction"',
  'has:attachment filename:pdf subject:invoice',
  'has:attachment filename:pdf subject:receipt',
];

// Skip attachments that are clearly not receipts
const SKIP_EXTENSIONS = new Set([
  '.ics', '.vcf', '.sig', '.p7s', '.html', '.htm',
  '.eml', '.msg', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.zip', '.rar', '.7z', '.gz',
  '.csv', '.txt', '.xml', '.json', '.mp3', '.mp4',
  '.mov', '.avi', '.wav',
]);
// Only process these MIME types — everything else is skipped
const PROCESSABLE_MIME_PREFIXES = ['image/', 'application/pdf'];
const MIN_PDF_SIZE = 5_000;            // 5KB — skip tiny PDFs
const MIN_IMAGE_SIZE = 30_000;         // 30KB — skip signature images/logos (real receipt photos are 50KB+)
const MAX_ATTACHMENT_SIZE = 25_000_000; // 25MB — skip huge files

// Filename patterns that indicate signature/logo images, NOT receipts
const SIGNATURE_IMAGE_PATTERNS = [
  /logo/i, /banner/i, /icon/i, /signature/i, /badge/i, /avatar/i,
  /facebook/i, /twitter/i, /linkedin/i, /instagram/i, /youtube/i,
  /tiktok/i, /pinterest/i, /snapchat/i, /social/i,
  /header/i, /footer/i, /spacer/i, /divider/i, /separator/i,
  /pixel/i, /tracking/i, /beacon/i, /1x1/i,
  /^image\d{3}\./i,  // image001.png, image002.jpg — Outlook inline images
  /unnamed/i,
];

/** Check if an image attachment is likely a signature/logo rather than a receipt */
function isLikelySignatureImage(att: GmailAttachment): boolean {
  // PDFs are never signatures
  if (att.mimeType === 'application/pdf') return false;

  // Inline images (embedded in email body via cid:) are almost always signatures
  if (att.isInline) return true;

  // Check filename against signature patterns
  const name = att.filename.toLowerCase();
  if (SIGNATURE_IMAGE_PATTERNS.some(pattern => pattern.test(name))) return true;

  return false;
}

// --- OAuth2 Setup ---

async function getGmailService(): Promise<gmail_v1.Gmail | null> {
  // Support env-var-based credentials (Railway) or file-based credentials (local dev)
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    // Environment variable approach (Railway / production)
    try {
      const oauth2Client = new OAuth2Client(clientId, clientSecret);
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Log token refreshes
      oauth2Client.on('tokens', (_newTokens) => {
        logger.info('Gmail OAuth token refreshed via env-var flow');
      });

      return google.gmail({ version: 'v1', auth: oauth2Client });
    } catch (error) {
      logger.error('Failed to initialize Gmail service from env vars:', error);
      return null;
    }
  }

  // Fallback: file-based credentials (local development)
  const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH;
  const tokenPath = process.env.GMAIL_TOKEN_PATH;

  if (!credentialsPath || !tokenPath) {
    logger.warn('Gmail scanning disabled: no credentials configured (set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN, or GMAIL_CREDENTIALS_PATH + GMAIL_TOKEN_PATH)');
    return null;
  }

  if (!fs.existsSync(credentialsPath)) {
    logger.error(`Gmail credentials file not found: ${credentialsPath}`);
    return null;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0]);

    // Load saved token
    if (fs.existsSync(tokenPath)) {
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      oauth2Client.setCredentials(token);

      // Handle token refresh
      oauth2Client.on('tokens', (newTokens) => {
        try {
          const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
          const merged = { ...existing, ...newTokens };
          fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
          logger.info('Gmail OAuth token refreshed');
        } catch (err) {
          logger.error('Failed to save refreshed Gmail token:', err);
        }
      });
    } else {
      logger.error('Gmail token not found. Run initial OAuth flow first.');
      return null;
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    logger.error('Failed to initialize Gmail service:', error);
    return null;
  }
}

// --- Message Search ---

async function searchMessages(
  gmail: gmail_v1.Gmail,
  query: string
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });

    for (const msg of res.data.messages || []) {
      if (msg.id) ids.push(msg.id);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return ids;
}

// --- Attachment Extraction ---

interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  isInline: boolean;    // Content-Disposition: inline OR has Content-ID (embedded in email body)
}

function extractAttachments(payload: any): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function walk(part: any) {
    if (part.filename && part.body?.attachmentId) {
      // Check MIME headers to detect inline/embedded images (signatures, logos)
      const headers: Array<{ name: string; value: string }> = part.headers || [];
      const contentDisposition = headers.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value || '';
      const contentId = headers.find((h: any) => h.name?.toLowerCase() === 'content-id')?.value || '';
      const isInline = contentDisposition.toLowerCase().startsWith('inline') || !!contentId;

      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
        isInline,
      });
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  if (payload) walk(payload);
  return attachments;
}

// --- HTML Body Extraction ---

function extractHtmlBody(payload: any): string | null {
  function walk(part: any): string | null {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      for (const child of part.parts) {
        const result = walk(child);
        if (result) return result;
      }
    }
    return null;
  }
  return payload ? walk(payload) : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function isLikelyReceiptEmail(subject: string, from: string): boolean {
  const s = subject.toLowerCase();
  const f = from.toLowerCase();
  const receiptKeywords = [
    'receipt', 'invoice', 'order confirm', 'payment confirm',
    'your order', 'purchase', 'transaction', 'billing',
  ];
  return receiptKeywords.some(kw => s.includes(kw) || f.includes(kw));
}

// --- Text-based Receipt Extraction ---

async function extractFromText(
  text: string,
  from: string,
  subject: string
): Promise<any> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a Canadian receipt data extractor for a business in Nova Scotia.
Extract transaction data from this email text.
Return JSON: { vendor, totalAmount, taxAmount, hstAmount, hstRegNumber, subtotal, purchaseDate (YYYY-MM-DD),
paymentMethod, lineItems: [{description, quantity, totalPrice}], category }
Categories: Supplies, Equipment, Services, Food, Office, Utilities, Fuel, Software, Advertising, Insurance, Rent, Maintenance, Professional Fees, Shipping, Other
If a field cannot be determined, use null.`
        },
        {
          role: 'user',
          content: `From: ${from}\nSubject: ${subject}\n\n${text.slice(0, 3000)}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    logger.warn('extractFromText failed:', { error: (err as any)?.message || 'Unknown error', from, subject: subject.slice(0, 80) });
    return null;
  }
}

// --- Text to PDF ---

async function textToPdf(
  text: string,
  subject: string,
  from: string,
  date: Date
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(`data:application/pdf;base64,${pdfBuffer.toString('base64')}`);
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text(subject, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica')
      .text(`From: ${from}`)
      .text(`Date: ${date.toISOString().slice(0, 10)}`);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown();

    // Body text
    doc.fontSize(10).font('Helvetica').text(text.slice(0, 5000), {
      width: 512,
      lineGap: 2,
    });

    doc.end();
  });
}

/** Generate a descriptive filename: YYYY-MM-DD_Vendor.pdf */
function generateReceiptFilename(ocrResult: any, emailDate: Date): string {
  const date = ocrResult?.purchaseDate || emailDate.toISOString().slice(0, 10);
  const vendor = (ocrResult?.vendor || 'Unknown')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `${date}_${vendor}.pdf`;
}

// --- Database Insert Helper ---

interface GmailReceiptInput {
  fileData: string;
  fileName: string;
  mimeType: string;
  contentHash: string;
  ocrResult: any;
  source: 'gmail_attachment' | 'gmail_body';
  gmailMessageId: string;
  sourceEmail: string;
  emailDate: Date;
}

async function insertGmailReceipt(input: GmailReceiptInput): Promise<string | null> {
  try {
    // Fuzzy duplicate check before insert
    let fuzzyDuplicateId: string | null = null;
    if (input.ocrResult?.vendor && input.ocrResult?.totalAmount) {
      const amountCents = Math.round(input.ocrResult.totalAmount * 100);
      const fuzzyParams: any[] = [`%${input.ocrResult.vendor.slice(0, 20)}%`, amountCents - 50, amountCents + 50];
      let fuzzyQuery = `SELECT id FROM receipts WHERE vendor ILIKE $1 AND amount_cents BETWEEN $2 AND $3`;
      if (input.ocrResult.purchaseDate) {
        fuzzyQuery += ` AND purchase_date BETWEEN ($4::date - interval '3 days') AND ($4::date + interval '3 days')`;
        fuzzyParams.push(input.ocrResult.purchaseDate);
      }
      fuzzyQuery += ` LIMIT 1`;
      const fuzzy = await db.query(fuzzyQuery, fuzzyParams);
      if (fuzzy.rows.length > 0) {
        fuzzyDuplicateId = fuzzy.rows[0].id;
      }
    }

    const result = await db.query(`
      INSERT INTO receipts (
        file_data, file_name, mime_type, content_hash,
        vendor, amount_cents, tax_cents, hst_cents, hst_reg_number,
        subtotal_cents, purchase_date, category, payment_method, notes,
        ocr_status, ocr_text, ocr_json, ocr_confidence,
        source, gmail_message_id, source_email, fuzzy_duplicate_of
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22
      )
      ON CONFLICT (content_hash) DO NOTHING
      RETURNING id
    `, [
      input.fileData,
      input.fileName,
      input.mimeType,
      input.contentHash,
      input.ocrResult?.vendor || null,
      input.ocrResult?.totalAmount ? Math.round(input.ocrResult.totalAmount * 100) : null,
      input.ocrResult?.taxAmount ? Math.round(input.ocrResult.taxAmount * 100) : null,
      input.ocrResult?.hstAmount ? Math.round(input.ocrResult.hstAmount * 100) : null,
      input.ocrResult?.hstRegNumber || null,
      input.ocrResult?.subtotal ? Math.round(input.ocrResult.subtotal * 100) : null,
      input.ocrResult?.purchaseDate || input.emailDate.toISOString().slice(0, 10),
      input.ocrResult?.category || null,
      input.ocrResult?.paymentMethod || null,
      `Auto-imported from Gmail: ${input.sourceEmail}`,
      input.ocrResult ? 'completed' : 'manual',
      input.ocrResult?.rawText || null,
      input.ocrResult ? JSON.stringify(input.ocrResult) : null,
      input.ocrResult?.confidence || 0,
      input.source,
      input.gmailMessageId,
      input.sourceEmail,
      fuzzyDuplicateId,
    ]);

    return result.rows[0]?.id || null;
  } catch (err) {
    logger.error('Failed to insert Gmail receipt:', err);
    return null;
  }
}

// --- Message Processing ---

async function processMessage(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<{ receiptsCreated: number; skippedReason: string | null }> {
  // Check if already processed
  const existing = await db.query(
    'SELECT 1 FROM gmail_scanned_messages WHERE message_id = $1',
    [messageId]
  );
  if (existing.rows.length > 0) {
    return { receiptsCreated: 0, skippedReason: 'already_processed' };
  }

  // Fetch full message
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = msg.data.payload?.headers || [];
  const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
  const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
  const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
  const emailDate = dateHeader ? new Date(dateHeader) : new Date();

  let receiptsCreated = 0;
  let insertsAttempted = 0;

  // --- Process attachments ---
  const attachments = extractAttachments(msg.data.payload);

  for (const att of attachments) {
    const ext = path.extname(att.filename).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;
    if (att.size > MAX_ATTACHMENT_SIZE) continue;

    // Size check — PDFs can be small (5KB), but images must be 30KB+ to skip signature logos
    const isImage = att.mimeType.startsWith('image/');
    const minSize = isImage ? MIN_IMAGE_SIZE : MIN_PDF_SIZE;
    if (att.size < minSize) {
      logger.info(`Skipping small ${isImage ? 'image' : 'file'}: ${att.filename} (${att.size} bytes < ${minSize})`);
      continue;
    }

    // MIME type check — only process images and PDFs
    const isProcessable = PROCESSABLE_MIME_PREFIXES.some(prefix => att.mimeType.startsWith(prefix));
    if (!isProcessable) {
      logger.info(`Skipping non-processable attachment: ${att.filename} (${att.mimeType})`);
      continue;
    }

    // Signature/logo detection — skip inline images and known signature patterns
    if (isLikelySignatureImage(att)) {
      logger.info(`Skipping signature/logo image: ${att.filename} (inline=${att.isInline}, size=${att.size})`);
      continue;
    }

    // Download attachment
    const attData = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: att.attachmentId,
    });

    if (!attData.data.data) continue;

    // Convert from URL-safe base64 to standard base64
    const base64Data = attData.data.data.replace(/-/g, '+').replace(/_/g, '/');

    // Content hash for dedup — INSERT ON CONFLICT handles atomically
    const contentHash = hash(base64Data);

    let fileData: string;
    let mimeType: string;
    let fileName: string;

    if (att.mimeType === 'application/pdf' || ext === '.pdf') {
      // Already a PDF — store as-is
      fileData = `data:application/pdf;base64,${base64Data}`;
      mimeType = 'application/pdf';

      // Use Veryfi if configured, otherwise GPT-4o
      const ocrResult = await processReceiptSmart(fileData);
      fileName = generateReceiptFilename(ocrResult, emailDate);

      insertsAttempted++;
      const receiptId = await insertGmailReceipt({
        fileData, fileName, mimeType, contentHash, ocrResult,
        source: 'gmail_attachment',
        gmailMessageId: messageId,
        sourceEmail: fromHeader,
        emailDate,
      });
      if (receiptId) receiptsCreated++;

    } else if (att.mimeType.startsWith('image/')) {
      // Image attachment — run OCR on image, then convert to PDF
      const imageDataUrl = `data:${att.mimeType};base64,${base64Data}`;

      const ocrResult = await processReceiptSmart(imageDataUrl);

      // Convert to PDF for storage
      try {
        fileData = await convertImageToPdf(imageDataUrl);
      } catch (convErr) {
        logger.warn('Image-to-PDF conversion failed, storing as original image:', { filename: att.filename, error: (convErr as any)?.message });
        fileData = imageDataUrl; // Fallback to original image
      }
      mimeType = 'application/pdf';
      fileName = generateReceiptFilename(ocrResult, emailDate);

      insertsAttempted++;
      const receiptId = await insertGmailReceipt({
        fileData, fileName, mimeType, contentHash, ocrResult,
        source: 'gmail_attachment',
        gmailMessageId: messageId,
        sourceEmail: fromHeader,
        emailDate,
      });
      if (receiptId) receiptsCreated++;
    }
    // Skip non-PDF, non-image attachments
  }

  // --- Process HTML body receipts ---
  // Many vendors embed receipt data in the email body (Amazon, Uber, Stripe, etc.)
  // Check body when: no receipts extracted yet (even if attachments existed but were skipped)
  if (receiptsCreated === 0) {
    const htmlBody = extractHtmlBody(msg.data.payload);
    if (htmlBody && isLikelyReceiptEmail(subject, fromHeader)) {
      const textContent = htmlToText(htmlBody);
      if (textContent.length > 50) {
        const ocrResult = await extractFromText(textContent, fromHeader, subject);
        if (ocrResult && (ocrResult.totalAmount || ocrResult.vendor)) {
          const contentHash = hash(textContent);

          // INSERT ON CONFLICT handles dedup atomically
          const fileData = await textToPdf(textContent, subject, fromHeader, emailDate);

          insertsAttempted++;
          const receiptId = await insertGmailReceipt({
            fileData,
            fileName: generateReceiptFilename(ocrResult, emailDate),
            mimeType: 'application/pdf',
            contentHash,
            ocrResult,
            source: 'gmail_body',
            gmailMessageId: messageId,
            sourceEmail: fromHeader,
            emailDate,
          });
          if (receiptId) receiptsCreated++;
        }
      }
    }
  }

  // Only mark as processed if:
  // 1. We created receipts (success), OR
  // 2. We had nothing to process (no processable attachments/body — not a receipt email)
  // Do NOT mark if we attempted inserts but all failed (allows retry on next scan)
  if (receiptsCreated > 0 || insertsAttempted === 0) {
    await db.query(`
      INSERT INTO gmail_scanned_messages
        (message_id, thread_id, from_address, subject, email_date,
         attachment_count, receipts_created)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (message_id) DO NOTHING
    `, [
      messageId,
      msg.data.threadId,
      fromHeader,
      subject,
      emailDate.toISOString(),
      attachments.length,
      receiptsCreated,
    ]);
  } else {
    logger.warn(`Skipping processed mark for message ${messageId}: ${insertsAttempted} inserts attempted, 0 succeeded`);
  }

  return { receiptsCreated, skippedReason: null };
}

// --- Main entry point ---

export async function runGmailScan(startDate?: string): Promise<{
  emailsScanned: number;
  receiptsCreated: number;
  duplicatesSkipped: number;
}> {
  if (process.env.GMAIL_SCAN_ENABLED !== 'true') {
    logger.info('Gmail scanning disabled');
    return { emailsScanned: 0, receiptsCreated: 0, duplicatesSkipped: 0 };
  }

  const gmail = await getGmailService();
  if (!gmail) {
    return { emailsScanned: 0, receiptsCreated: 0, duplicatesSkipped: 0 };
  }

  // Default to last 30 days if no startDate provided
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultDate = `after:${thirtyDaysAgo.getFullYear()}/${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}/${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
  const dateFilter = startDate || defaultDate;

  // Collect unique message IDs from all queries
  const allMessageIds = new Set<string>();

  // Phase 1: Primary queries (category:purchases catches ~80% of receipts)
  for (const query of PRIMARY_QUERIES) {
    const fullQuery = `in:anywhere ${query} ${dateFilter}`;
    try {
      const ids = await searchMessages(gmail, fullQuery);
      ids.forEach(id => allMessageIds.add(id));
      logger.info(`Primary query "${query}": found ${ids.length} messages`);
    } catch (err) {
      logger.warn(`Primary Gmail query failed: ${query}`, err);
    }
  }

  // Phase 2: Vendor-specific + keyword queries (catches edge cases category:purchases misses)
  for (const query of [...VENDOR_QUERIES, ...KEYWORD_QUERIES]) {
    const fullQuery = `in:anywhere ${query} ${dateFilter}`;
    try {
      const ids = await searchMessages(gmail, fullQuery);
      ids.forEach(id => allMessageIds.add(id));
    } catch (err) {
      logger.warn(`Gmail query failed: ${query}`, err);
    }
  }

  logger.info(`Gmail scan: ${allMessageIds.size} unique messages to process`);

  let receiptsCreated = 0;
  let duplicatesSkipped = 0;

  for (const msgId of allMessageIds) {
    try {
      const result = await processMessage(gmail, msgId);
      receiptsCreated += result.receiptsCreated;
      if (result.skippedReason === 'already_processed') duplicatesSkipped++;

      // Rate limiting: ~2 requests/second to stay within Gmail API quotas
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      logger.error(`Failed to process Gmail message ${msgId}:`, err);
    }
  }

  logger.info(`Gmail scan complete: ${allMessageIds.size} emails, ${receiptsCreated} receipts created, ${duplicatesSkipped} skipped`);

  return {
    emailsScanned: allMessageIds.size,
    receiptsCreated,
    duplicatesSkipped,
  };
}
