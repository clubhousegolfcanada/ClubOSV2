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
import { processReceiptWithOCR } from '../ocr/receiptOCR';
import { convertImageToPdf } from '../receipt/imageToPdf';
import { hash } from '../../utils/encryption';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

// --- Configuration ---

const VENDOR_QUERIES = [
  'from:homedepot', 'from:bestbuy', 'from:amazon',
  'from:ikea', 'from:walmart', 'from:costco',
  'from:nspower', 'from:bellaliant', 'from:bell.ca',
  'from:eastlink', 'from:rogers', 'from:telus',
  'from:shopify', 'from:stripe', 'from:square',
  'from:anthropic', 'from:openai', 'from:hubspot',
  'from:vistaprint', 'from:kent.ca', 'from:canadiantire',
  'from:staples', 'from:google subject:payment',
  'from:petro-canada', 'from:ultramar',
];

const KEYWORD_QUERIES = [
  'subject:receipt', 'subject:invoice', 'subject:"order confirmation"',
  'subject:"payment confirmation"', 'subject:"your order"',
  'subject:"purchase confirmation"', 'has:attachment filename:pdf subject:invoice',
  'has:attachment filename:pdf subject:receipt',
];

// Skip attachments that are clearly not receipts
const SKIP_EXTENSIONS = new Set(['.ics', '.vcf', '.sig', '.p7s', '.html', '.htm']);
const MIN_ATTACHMENT_SIZE = 5_000;     // 5KB — skip tiny files
const MAX_ATTACHMENT_SIZE = 25_000_000; // 25MB — skip huge files

// --- OAuth2 Setup ---

async function getGmailService(): Promise<gmail_v1.Gmail | null> {
  const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH;
  const tokenPath = process.env.GMAIL_TOKEN_PATH;

  if (!credentialsPath || !tokenPath) {
    logger.warn('Gmail scanning disabled: credentials not configured');
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
}

function extractAttachments(payload: any): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function walk(part: any) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
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
  } catch {
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

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
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
    const result = await db.query(`
      INSERT INTO receipts (
        file_data, file_name, mime_type, content_hash,
        vendor, amount_cents, tax_cents, hst_cents, hst_reg_number,
        purchase_date, category, payment_method, notes,
        ocr_status, ocr_text, ocr_json, ocr_confidence,
        source, gmail_message_id, source_email
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20
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

  // --- Process attachments ---
  const attachments = extractAttachments(msg.data.payload);

  for (const att of attachments) {
    const ext = path.extname(att.filename).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) continue;
    if (att.size < MIN_ATTACHMENT_SIZE || att.size > MAX_ATTACHMENT_SIZE) continue;

    // Download attachment
    const attData = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: att.attachmentId,
    });

    if (!attData.data.data) continue;

    // Convert from URL-safe base64 to standard base64
    const base64Data = attData.data.data.replace(/-/g, '+').replace(/_/g, '/');

    // Check for duplicate via content hash
    const contentHash = hash(base64Data);
    const dupCheck = await db.query(
      'SELECT id FROM receipts WHERE content_hash = $1',
      [contentHash]
    );
    if (dupCheck.rows.length > 0) continue;

    let fileData: string;
    let mimeType: string;
    let fileName: string;

    if (att.mimeType === 'application/pdf' || ext === '.pdf') {
      // Already a PDF — store as-is
      fileData = `data:application/pdf;base64,${base64Data}`;
      mimeType = 'application/pdf';
      fileName = att.filename;

      // GPT-4o can read PDFs natively via base64
      const ocrResult = await processReceiptWithOCR(fileData);

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

      const ocrResult = await processReceiptWithOCR(imageDataUrl);

      // Convert to PDF for storage
      try {
        fileData = await convertImageToPdf(imageDataUrl);
      } catch {
        fileData = imageDataUrl; // Fallback to original image
      }
      mimeType = 'application/pdf';
      fileName = att.filename.replace(/\.[^.]+$/, '.pdf');

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
  // Some vendors embed receipt data in the email body (no attachment)
  if (receiptsCreated === 0 && attachments.length === 0) {
    const htmlBody = extractHtmlBody(msg.data.payload);
    if (htmlBody && isLikelyReceiptEmail(subject, fromHeader)) {
      const textContent = htmlToText(htmlBody);
      if (textContent.length > 50) {
        const ocrResult = await extractFromText(textContent, fromHeader, subject);
        if (ocrResult && (ocrResult.totalAmount || ocrResult.vendor)) {
          const contentHash = hash(textContent);

          const dupCheck = await db.query(
            'SELECT id FROM receipts WHERE content_hash = $1',
            [contentHash]
          );
          if (dupCheck.rows.length === 0) {
            const fileData = await textToPdf(textContent, subject, fromHeader, emailDate);

            const receiptId = await insertGmailReceipt({
              fileData,
              fileName: `${sanitizeFilename(subject)}.pdf`,
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
  }

  // Record that we processed this message
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

  const dateFilter = startDate || 'after:2025/06/01';

  // Collect unique message IDs from all queries
  const allMessageIds = new Set<string>();

  for (const query of [...VENDOR_QUERIES, ...KEYWORD_QUERIES]) {
    const fullQuery = `${query} ${dateFilter}`;
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
