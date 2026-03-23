# ClubOS Receipt System Upgrade — Implementation Spec

## Overview

Upgrade the existing ClubOS receipt system with three capabilities:
1. **JPEG → PDF conversion** on terminal capture (receipts stored as PDFs, not JPEGs)
2. **Gmail auto-scanning** for receipts from mike@clubhouse247golf.com
3. **Enhanced OCR extraction** with HST registration number + line item improvements

The existing receipt system already has: GPT-4o Vision OCR, base64 storage in PostgreSQL, duplicate detection via content_hash, search, export (CSV/JSON/ZIP), and reconciliation. This spec builds on top of that — no rewrites.

---

## Current Architecture (DO NOT CHANGE)

```
Frontend: Next.js 15 (Vercel)
Backend:  Express.js + TypeScript (Railway)
Database: PostgreSQL 14 (Railway)
Cache:    Redis (Railway)
OCR:      OpenAI GPT-4o Vision API
Auth:     JWT with role-based access (admin, staff, operator)
```

**Key files:**
- `ClubOSV1-backend/src/routes/receipts-simple.ts` — All receipt CRUD + export endpoints
- `ClubOSV1-backend/src/services/ocr/receiptOCR.ts` — GPT-4o Vision OCR processing
- `ClubOSV1-frontend/src/components/RequestForm.tsx` — Terminal receipt capture UI
- `ClubOSV1-backend/src/database/migrations/` — PostgreSQL migrations

**Current receipt flow:**
1. Staff clicks "Receipt" button on terminal → takes photo
2. Frontend compresses to JPEG (80% quality, max 2000px) via canvas
3. Sends base64 to `POST /api/receipts/upload`
4. Backend runs GPT-4o Vision → extracts vendor/amount/date/tax/category
5. Stores base64 JPEG + OCR data in PostgreSQL `receipts` table
6. Export as CSV/JSON/ZIP sends JPEG images

---

## Feature 1: JPEG → PDF Conversion on Capture

### Problem
Receipts are stored as JPEG images. For accounting/tax purposes, PDFs are the standard format. The accountant needs PDFs, not JPEGs.

### Solution
Convert the JPEG image to a single-page PDF server-side before storing. The OCR still runs on the original image (GPT-4o Vision needs image input), but the stored `file_data` becomes a PDF.

### Backend Changes

#### Install dependency
```bash
npm install pdfkit
npm install -D @types/pdfkit
```

#### New service: `src/services/receipt/imageToPdf.ts`

```typescript
import PDFDocument from 'pdfkit';

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
      let mimeType = 'image/jpeg';
      if (base64Image.includes(',')) {
        const parts = base64Image.split(',');
        rawBase64 = parts[1];
        if (parts[0].includes('image/png')) mimeType = 'image/png';
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
```

#### Modify: `src/routes/receipts-simple.ts` — Upload endpoint

In the `POST /upload` handler, after OCR processing but before database insert, convert the image to PDF:

```typescript
// === ADD THIS IMPORT at top of file ===
import { convertImageToPdf } from '../services/receipt/imageToPdf';

// === ADD THIS BLOCK after OCR processing (after line ~554), before the INSERT ===

// Convert image to PDF for storage (OCR already ran on the original image)
let storageData = file_data;
let storageMimeType = mime_type || 'application/pdf';
let storageFileName = file_name;

if (mime_type && mime_type.startsWith('image/')) {
  try {
    logger.info('Converting receipt image to PDF for storage');
    storageData = await convertImageToPdf(file_data);
    storageMimeType = 'application/pdf';
    // Change filename extension to .pdf
    storageFileName = file_name.replace(/\.(jpe?g|png|heic|webp)$/i, '.pdf');
    if (!storageFileName.endsWith('.pdf')) {
      storageFileName += '.pdf';
    }
    logger.info('Image converted to PDF successfully');
  } catch (convError) {
    logger.warn('PDF conversion failed, storing as original image:', convError);
    // Fall back to storing the original image — don't block the upload
  }
}

// === THEN UPDATE the INSERT to use storageData/storageMimeType/storageFileName ===
// Replace: file_data    → storageData
// Replace: mime_type     → storageMimeType
// Replace: file_name     → storageFileName
```

#### Update the INSERT query parameters

In both INSERT branches (with and without content_hash), replace:
- `file_data` → `storageData`
- `file_name` → `storageFileName`
- `mime_type || 'application/pdf'` → `storageMimeType`

The content_hash should still be computed on the ORIGINAL `file_data` (the image), not the PDF, so that duplicate detection works regardless of conversion.

#### Update export ZIP handler

In the ZIP export section (~line 349), update the file extension detection to handle the new PDFs properly. The existing code already handles `application/pdf` in the mime type check, so this should work without changes. Verify that the `extension` variable correctly resolves to `'pdf'` for converted receipts.

### Frontend Changes

**No frontend changes needed.** The frontend continues to send JPEG base64 to the upload endpoint. The conversion happens server-side. The frontend doesn't need to know the storage format changed.

### Migration

**No migration needed.** The `file_data` column is TEXT (base64), `mime_type` is VARCHAR, and `file_name` is VARCHAR — all already support PDF data. Existing JPEG receipts remain as-is (no backfill required, but a backfill script can be written later if desired).

---

## Feature 2: Gmail Auto-Scanning

### Problem
Many receipts arrive via email (Home Depot, Best Buy, NS Power, Bell, Amazon, etc.) and never get uploaded to ClubOS. Staff have to manually download and upload them.

### Solution
A backend service that connects to mike@clubhouse247golf.com via Gmail API, scans for receipt emails, extracts attachments and HTML body receipts, and inserts them into the existing `receipts` table.

### Database Migration

#### New migration: `XXX_gmail_receipt_scanning.sql`

```sql
-- Gmail message tracking for idempotent receipt scanning
CREATE TABLE IF NOT EXISTS gmail_scanned_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT UNIQUE NOT NULL,        -- Gmail message ID
  thread_id       TEXT,
  from_address    TEXT,
  subject         TEXT,
  email_date      TIMESTAMPTZ,
  attachment_count INTEGER DEFAULT 0,
  receipts_created INTEGER DEFAULT 0,
  skipped_reason  TEXT,                         -- 'duplicate', 'not_receipt', 'too_large', etc.
  processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gmail_scanned_date ON gmail_scanned_messages(email_date);
CREATE INDEX idx_gmail_scanned_msg_id ON gmail_scanned_messages(message_id);

-- Add source tracking to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'terminal';
-- Values: 'terminal' (manual upload), 'gmail_attachment', 'gmail_body', 'forwarded'

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source_email TEXT;

CREATE INDEX idx_receipts_source ON receipts(source);
CREATE INDEX idx_receipts_gmail_msg ON receipts(gmail_message_id);
```

### Google OAuth Setup

#### Prerequisites (one-time, manual)
1. Go to Google Cloud Console → APIs & Services → Enable Gmail API
2. Create OAuth 2.0 credentials (Desktop app type)
3. Download credentials JSON → save as `config/gmail_credentials.json` on the Railway server
4. First run triggers browser OAuth flow → saves token to `config/gmail_token.json`
5. Add these environment variables to Railway:
   ```
   GMAIL_CREDENTIALS_PATH=/app/config/gmail_credentials.json
   GMAIL_TOKEN_PATH=/app/config/gmail_token.json
   GMAIL_SCAN_EMAIL=mike@clubhouse247golf.com
   GMAIL_SCAN_ENABLED=true
   ```

#### Important: Token refresh
The OAuth token expires periodically. The service must handle refresh automatically using the refresh_token. If the refresh fails, log an error and send a notification — don't crash the server.

### New Service: `src/services/gmail/gmailReceiptScanner.ts`

```typescript
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
        const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        const merged = { ...existing, ...newTokens };
        fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
        logger.info('Gmail OAuth token refreshed');
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
    // Skip non-receipt files
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

    // Determine mime type and prepare for storage
    let fileData: string;
    let mimeType: string;
    let fileName: string;

    if (att.mimeType === 'application/pdf' || ext === '.pdf') {
      // Already a PDF — store as-is
      fileData = `data:application/pdf;base64,${base64Data}`;
      mimeType = 'application/pdf';
      fileName = att.filename;
    } else if (att.mimeType.startsWith('image/')) {
      // Image attachment — convert to PDF
      const imageDataUrl = `data:${att.mimeType};base64,${base64Data}`;

      // Run OCR on the image first (needs image input)
      const ocrResult = await processReceiptWithOCR(imageDataUrl);

      // Convert to PDF for storage
      fileData = await convertImageToPdf(imageDataUrl);
      mimeType = 'application/pdf';
      fileName = att.filename.replace(/\.[^.]+$/, '.pdf');

      // Insert receipt
      await insertGmailReceipt({
        fileData,
        fileName,
        mimeType,
        contentHash,
        ocrResult,
        source: 'gmail_attachment',
        gmailMessageId: messageId,
        sourceEmail: fromHeader,
        emailDate,
      });
      receiptsCreated++;
      continue;
    } else {
      continue; // Skip non-PDF, non-image attachments
    }

    // For PDFs: run OCR by converting first page to image
    // GPT-4o can read PDFs natively via base64 — send as-is
    const ocrResult = await processReceiptWithOCR(fileData);

    await insertGmailReceipt({
      fileData,
      fileName,
      mimeType,
      contentHash,
      ocrResult,
      source: 'gmail_attachment',
      gmailMessageId: messageId,
      sourceEmail: fromHeader,
      emailDate,
    });
    receiptsCreated++;
  }

  // --- Process HTML body receipts ---
  // Some vendors embed receipt data in the email body (no attachment)
  if (receiptsCreated === 0 && attachments.length === 0) {
    const htmlBody = extractHtmlBody(msg.data.payload);
    if (htmlBody && isLikelyReceiptEmail(subject, fromHeader)) {
      // Extract text from HTML, look for receipt-like content
      const textContent = htmlToText(htmlBody);
      if (textContent.length > 50) {
        // Create a text-based "receipt" entry (no file, just OCR data)
        const ocrResult = await extractFromText(textContent, fromHeader, subject);
        if (ocrResult && (ocrResult.totalAmount || ocrResult.vendor)) {
          // Generate a simple PDF from the text content
          fileData = await textToPdf(textContent, subject, fromHeader, emailDate);
          const contentHash = hash(textContent);

          const dupCheck = await db.query(
            'SELECT id FROM receipts WHERE content_hash = $1',
            [contentHash]
          );
          if (dupCheck.rows.length === 0) {
            await insertGmailReceipt({
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
            receiptsCreated++;
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

// --- Helper: Insert receipt from Gmail ---

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

async function insertGmailReceipt(input: GmailReceiptInput): Promise<string> {
  const result = await db.query(`
    INSERT INTO receipts (
      file_data, file_name, mime_type, content_hash,
      vendor, amount_cents, tax_cents, purchase_date,
      category, payment_method, notes,
      ocr_status, ocr_text, ocr_json, ocr_confidence,
      source, gmail_message_id, source_email
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18
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

  return result.rows[0]?.id;
}

// --- Helper functions (implement these) ---

function extractAttachments(payload: any): Array<{
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}> {
  // Recursively walk MIME parts to find attachments
  const attachments: any[] = [];

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

function extractHtmlBody(payload: any): string | null {
  // Walk MIME tree to find text/html part
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
  // Strip HTML tags, decode entities, collapse whitespace
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

async function extractFromText(
  text: string,
  from: string,
  subject: string
): Promise<any> {
  // Use GPT-4o to extract receipt data from plain text
  // (same approach as image OCR, but with text input)
  const openai = new (await import('openai')).default({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a receipt data extractor. Extract transaction data from this email text.
        Return JSON: { vendor, totalAmount, taxAmount, subtotal, purchaseDate (YYYY-MM-DD),
        paymentMethod, lineItems: [{description, quantity, totalPrice}], category }
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
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function textToPdf(
  text: string,
  subject: string,
  from: string,
  date: Date
): Promise<string> {
  // Generate a simple PDF from email text content
  const PDFDocument = (await import('pdfkit')).default;

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
```

### New Route: `src/routes/gmail-scan.ts`

```typescript
import express from 'express';
import { authenticate } from '../middleware/auth';
import { runGmailScan } from '../services/gmail/gmailReceiptScanner';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/gmail/scan
 * Trigger a Gmail receipt scan (admin only)
 */
router.post('/scan', authenticate, async (req, res) => {
  const { user } = req as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { startDate } = req.body; // Optional: 'after:2025/01/01'

  try {
    const result = await runGmailScan(startDate);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Gmail scan failed:', error);
    res.status(500).json({ error: 'Gmail scan failed' });
  }
});

/**
 * GET /api/gmail/status
 * Get Gmail scanning statistics
 */
router.get('/status', authenticate, async (req, res) => {
  const { user } = req as any;
  if (!['admin', 'staff'].includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const { db: database } = require('../utils/database');

    const stats = await database.query(`
      SELECT
        COUNT(*) as total_scanned,
        SUM(receipts_created) as total_receipts_created,
        MAX(processed_at) as last_scan_at,
        COUNT(DISTINCT from_address) as unique_senders
      FROM gmail_scanned_messages
    `);

    const recentSenders = await database.query(`
      SELECT from_address, COUNT(*) as count, SUM(receipts_created) as receipts
      FROM gmail_scanned_messages
      WHERE receipts_created > 0
      GROUP BY from_address
      ORDER BY receipts DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        ...stats.rows[0],
        topSenders: recentSenders.rows,
      }
    });
  } catch (error) {
    logger.error('Gmail status error:', error);
    res.status(500).json({ error: 'Failed to get Gmail status' });
  }
});

export default router;
```

### Register the route in your main app file

```typescript
import gmailScanRouter from './routes/gmail-scan';
app.use('/api/gmail', gmailScanRouter);
```

### Scheduled scanning (optional)

Add a cron job to run Gmail scanning daily/weekly. Use `node-cron` or Railway's built-in cron:

```typescript
// In src/index.ts or a separate scheduler file
import cron from 'node-cron';
import { runGmailScan } from './services/gmail/gmailReceiptScanner';

// Run Gmail scan every day at 6 AM Atlantic
if (process.env.GMAIL_SCAN_ENABLED === 'true') {
  cron.schedule('0 6 * * *', async () => {
    logger.info('Starting scheduled Gmail receipt scan');
    try {
      // Only scan last 30 days on scheduled runs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFilter = `after:${thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '/')}`;
      await runGmailScan(dateFilter);
    } catch (error) {
      logger.error('Scheduled Gmail scan failed:', error);
    }
  });
}
```

### Install dependencies

```bash
npm install googleapis google-auth-library node-cron
npm install -D @types/node-cron
```

---

## Feature 3: Enhanced OCR Extraction

### Problem
The current OCR prompt doesn't extract HST registration numbers or split HST from provincial/federal tax. For Canadian business accounting, the HST registration number is critical for claiming Input Tax Credits.

### Solution
Update the GPT-4o system prompt in `receiptOCR.ts` to extract additional fields.

### Modify: `src/services/ocr/receiptOCR.ts`

#### Update the interface

```typescript
export interface ReceiptOCRResult {
  vendor: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  hstAmount: number | null;       // NEW: HST/GST specifically
  hstRegNumber: string | null;    // NEW: HST registration number
  subtotal: number | null;
  purchaseDate: string | null;
  paymentMethod: string | null;
  lineItems: LineItem[];
  rawText: string;
  confidence: number;
  category?: string;
}
```

#### Update the system prompt (replace existing)

```typescript
content: `You are a Canadian receipt OCR specialist for a business in Nova Scotia.
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
- For HST reg number: this is critical for tax purposes — search carefully`
```

#### Update the result builder to include new fields

```typescript
const result: ReceiptOCRResult = {
  vendor: extractedData.vendor || null,
  totalAmount: parseFloat(extractedData.totalAmount) || null,
  taxAmount: parseFloat(extractedData.taxAmount) || null,
  hstAmount: parseFloat(extractedData.hstAmount) || null,
  hstRegNumber: extractedData.hstRegNumber || null,
  subtotal: parseFloat(extractedData.subtotal) || null,
  purchaseDate: extractedData.purchaseDate || null,
  paymentMethod: extractedData.paymentMethod || null,
  lineItems: Array.isArray(extractedData.lineItems) ? extractedData.lineItems : [],
  rawText: content,
  confidence: calculateConfidence(extractedData),
  category: extractedData.category || categorizeByVendor(extractedData.vendor)
};
```

#### Update confidence calculation

```typescript
function calculateConfidence(data: any): number {
  let score = 0;
  if (data.vendor) score += 20;
  if (data.totalAmount) score += 20;
  if (data.purchaseDate) score += 15;
  if (data.taxAmount || data.hstAmount) score += 10;
  if (data.hstRegNumber) score += 10;  // Bonus for HST reg
  if (data.subtotal) score += 10;
  if (data.paymentMethod) score += 5;
  if (data.lineItems && data.lineItems.length > 0) score += 10;
  return Math.min(score, 100) / 100;
}
```

#### Update display formatter

Add HST fields to `formatOCRForDisplay()`:

```typescript
if (result.hstAmount !== null) {
  lines.push(`**HST:** $${result.hstAmount.toFixed(2)}`);
}
if (result.hstRegNumber) {
  lines.push(`**HST Reg#:** ${result.hstRegNumber}`);
}
```

### Database migration for new OCR fields

```sql
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS hst_cents INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS hst_reg_number TEXT;
```

Update the INSERT in `receipts-simple.ts` upload handler to include:
- `hst_cents` from `ocrResult.hstAmount ? Math.round(ocrResult.hstAmount * 100) : null`
- `hst_reg_number` from `ocrResult.hstRegNumber || null`

---

## Implementation Order

### Phase 1: JPEG → PDF conversion (1-2 hours)
1. Create `src/services/receipt/imageToPdf.ts`
2. Modify upload handler in `receipts-simple.ts`
3. Install `pdfkit`
4. Test: upload a JPEG receipt, verify it's stored as PDF
5. Test: export ZIP, verify files are .pdf not .jpg
6. Test: existing JPEG receipts still display/export correctly

### Phase 2: Enhanced OCR (30 minutes)
1. Run database migration (add `hst_cents`, `hst_reg_number` columns)
2. Update `ReceiptOCRResult` interface
3. Update GPT-4o system prompt
4. Update confidence calculation and display formatter
5. Update INSERT queries to save new fields
6. Test: upload a receipt with visible HST reg number, verify extraction

### Phase 3: Gmail scanning (2-3 hours)
1. Run database migration (add `gmail_scanned_messages` table + receipt columns)
2. Install `googleapis`, `google-auth-library`, `node-cron`
3. Create `src/services/gmail/gmailReceiptScanner.ts`
4. Create `src/routes/gmail-scan.ts`
5. Register route in app
6. Set up Gmail OAuth credentials on Railway
7. Run initial OAuth flow (one-time browser auth)
8. Test: `POST /api/gmail/scan` → verify receipts appear in database
9. Set up daily cron schedule
10. Test: verify duplicate detection across terminal + Gmail uploads

### Phase 4: Verification
1. Upload a JPEG receipt via terminal → verify stored as PDF
2. Trigger Gmail scan → verify emails processed, receipts as PDF
3. Export ZIP → verify all files are PDF
4. Check OCR results include HST reg numbers
5. Verify no duplicate receipts between terminal and Gmail sources

---

## Environment Variables (add to Railway)

```
# Gmail scanning (Feature 2)
GMAIL_CREDENTIALS_PATH=/app/config/gmail_credentials.json
GMAIL_TOKEN_PATH=/app/config/gmail_token.json
GMAIL_SCAN_EMAIL=mike@clubhouse247golf.com
GMAIL_SCAN_ENABLED=true
```

## New Dependencies

```
pdfkit                  — Image/text to PDF conversion
googleapis              — Gmail API client
google-auth-library     — OAuth2 for Gmail
node-cron               — Scheduled scanning

@types/pdfkit           — TypeScript types (dev)
@types/node-cron        — TypeScript types (dev)
```

## Files Created/Modified Summary

```
NEW:
  src/services/receipt/imageToPdf.ts         — JPEG→PDF conversion
  src/services/gmail/gmailReceiptScanner.ts  — Gmail receipt scanner
  src/routes/gmail-scan.ts                   — Gmail scan API endpoints
  src/database/migrations/XXX_gmail_receipt_scanning.sql
  src/database/migrations/XXX_receipt_hst_fields.sql

MODIFIED:
  src/routes/receipts-simple.ts              — Add PDF conversion to upload
  src/services/ocr/receiptOCR.ts             — Enhanced OCR prompt + HST fields
  src/index.ts (or app.ts)                   — Register gmail route + cron
  package.json                               — New dependencies
```
