import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { body, validationResult, query } from 'express-validator';
import { processReceiptWithOCR, formatOCRForDisplay } from '../services/ocr/receiptOCR';
import { processReceiptSmart } from '../services/ocr/veryfiOCR';
import { convertImageToPdf } from '../services/receipt/imageToPdf';
import { format } from 'date-fns';
import { Parser } from 'json2csv';
import archiver from 'archiver';
import { hash } from '../utils/encryption';

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limiter for upload endpoint (50 uploads per minute per user — supports bulk upload)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: 'Too many uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.user?.id || req.ip
});

/**
 * GET /api/receipts/summary
 * Get receipt summary statistics
 */
router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (!['admin', 'staff', 'operator'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { period = 'month', year, month } = req.query;

    // Build date filter based on period - using parameterized queries
    let dateFilter = '';
    let queryParams: any[] = [];
    const now = new Date();

    switch (period) {
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = 'WHERE COALESCE(purchase_date, created_at::date) >= $1';
        queryParams = [weekStart.toISOString()];
        break;
      case 'month':
        // Support custom month selection via year and month params
        if (year && month) {
          const customMonthStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
          const customMonthEnd = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
          dateFilter = 'WHERE COALESCE(purchase_date, created_at::date) >= $1 AND COALESCE(purchase_date, created_at::date) <= $2';
          queryParams = [customMonthStart.toISOString(), customMonthEnd.toISOString()];
        } else {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = 'WHERE COALESCE(purchase_date, created_at::date) >= $1';
          queryParams = [monthStart.toISOString()];
        }
        break;
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = 'WHERE COALESCE(purchase_date, created_at::date) >= $1';
        queryParams = [yearStart.toISOString()];
        break;
      case 'all':
      default:
        dateFilter = '';
        queryParams = [];
        break;
    }

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(*) as total_receipts,
        COALESCE(SUM(amount_cents), 0) as total_amount_cents,
        COALESCE(SUM(tax_cents), 0) as total_tax_cents,
        COALESCE(SUM(hst_cents), 0) as total_hst_cents,
        COUNT(*) FILTER (WHERE reconciled = false OR reconciled IS NULL) as unreconciled_count,
        MIN(created_at) as earliest_receipt,
        MAX(created_at) as latest_receipt
      FROM receipts
      ${dateFilter}
    `;

    const summary = await db.query(summaryQuery, queryParams);
    const result = summary.rows[0] || {
      total_receipts: 0,
      total_amount_cents: 0,
      total_tax_cents: 0,
      total_hst_cents: 0,
      unreconciled_count: 0,
      earliest_receipt: null,
      latest_receipt: null
    };

    // Get category breakdown
    const categoryQuery = `
      SELECT
        COALESCE(category, 'Uncategorized') as category,
        COUNT(*) as count,
        COALESCE(SUM(amount_cents), 0) as total_cents
      FROM receipts
      ${dateFilter}
      GROUP BY category
      ORDER BY total_cents DESC
      LIMIT 10
    `;
    const categoryResult = await db.query(categoryQuery, queryParams);

    res.json({
      totalReceipts: parseInt(result.total_receipts) || 0,
      totalAmount: (parseInt(result.total_amount_cents) || 0) / 100,
      totalTax: (parseInt(result.total_tax_cents) || 0) / 100,
      totalHst: (parseInt(result.total_hst_cents) || 0) / 100,
      unreconciled: parseInt(result.unreconciled_count) || 0,
      categories: categoryResult.rows.map((row: any) => ({
        category: row.category,
        count: parseInt(row.count) || 0,
        total: (parseInt(row.total_cents) || 0) / 100
      })),
      dateRange: {
        from: result.earliest_receipt,
        to: result.latest_receipt
      },
      lastExport: null // Will be tracked client-side
    });

  } catch (error) {
    logger.error('Error fetching receipt summary:', error);
    res.status(500).json({
      error: 'Failed to fetch receipt summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/receipts/export
 * Export receipts with filtering
 */
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;

    // Role check — only admin, staff, operator can export receipts
    if (!['admin', 'staff', 'operator'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const {
      period = 'month',
      format: exportFormat = 'csv',
      year,
      month,
      includePhotos
    } = req.query;

    // Build date filter with parameterized queries to prevent SQL injection
    let dateFilter = '';
    let queryParams: any[] = [];
    const now = new Date();
    let periodLabel = '';

    switch (period) {
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = 'WHERE r.created_at >= $1';
        queryParams = [weekStart.toISOString()];
        periodLabel = `week_of_${format(weekStart, 'yyyy_MM_dd')}`;
        break;

      case 'month':
        if (year && month) {
          const customMonthStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
          const customMonthEnd = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
          dateFilter = 'WHERE r.created_at >= $1 AND r.created_at <= $2';
          queryParams = [customMonthStart.toISOString(), customMonthEnd.toISOString()];
          periodLabel = `${year}_${String(month).padStart(2, '0')}`;
        } else {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = 'WHERE r.created_at >= $1';
          queryParams = [monthStart.toISOString()];
          periodLabel = format(now, 'yyyy_MM');
        }
        break;

      case 'year':
        if (year) {
          const customYearStart = new Date(parseInt(year as string), 0, 1);
          const customYearEnd = new Date(parseInt(year as string), 11, 31, 23, 59, 59);
          dateFilter = 'WHERE r.created_at >= $1 AND r.created_at <= $2';
          queryParams = [customYearStart.toISOString(), customYearEnd.toISOString()];
          periodLabel = year as string;
        } else {
          const yearStart = new Date(now.getFullYear(), 0, 1);
          dateFilter = 'WHERE r.created_at >= $1';
          queryParams = [yearStart.toISOString()];
          periodLabel = String(now.getFullYear());
        }
        break;

      case 'all':
      default:
        dateFilter = '';
        queryParams = [];
        periodLabel = 'all_time';
        break;
    }

    // Fetch receipts using parameterized query (exclude file_data to avoid memory issues)
    const receiptsQuery = `
      SELECT
        r.id, r.file_name, r.file_size, r.mime_type, r.vendor, r.amount_cents, r.tax_cents,
        r.hst_cents, r.hst_reg_number, r.purchase_date, r.club_location, r.category,
        r.payment_method, r.notes, r.ocr_status, r.reconciled, r.reconciled_at,
        r.reconciled_by, r.uploader_user_id, r.created_at, r.updated_at, r.source,
        r.is_personal_card, r.content_hash,
        u.name as uploader_name,
        u.email as uploader_email
      FROM receipts r
      LEFT JOIN users u ON r.uploader_user_id = u.id
      ${dateFilter}
      ORDER BY r.created_at DESC
    `;

    const receiptsResult = await db.query(receiptsQuery, queryParams);
    const receipts = receiptsResult.rows;

    // Format based on export type
    if (exportFormat === 'csv') {
      // Prepare data for CSV
      const csvData = receipts.map((receipt: any) => ({
        'Date': format(new Date(receipt.purchase_date || receipt.created_at), 'yyyy-MM-dd'),
        'Vendor': receipt.vendor || '',
        'Amount': receipt.amount_cents ? (receipt.amount_cents / 100).toFixed(2) : '0.00',
        'Tax': receipt.tax_cents ? (receipt.tax_cents / 100).toFixed(2) : '0.00',
        'HST': receipt.hst_cents ? (receipt.hst_cents / 100).toFixed(2) : '',
        'HST Reg#': receipt.hst_reg_number || '',
        'Subtotal': receipt.subtotal_cents ? (receipt.subtotal_cents / 100).toFixed(2) : '0.00',
        'Category': receipt.category || '',
        'Payment Method': receipt.payment_method || '',
        'Location': receipt.club_location || '',
        'Personal Card': receipt.is_personal_card ? 'Yes' : 'No',
        'Notes': receipt.notes || '',
        'Uploaded By': receipt.uploader_name || '',
        'Upload Date': format(new Date(receipt.created_at), 'yyyy-MM-dd HH:mm'),
        'Reconciled': receipt.reconciled ? 'Yes' : 'No'
      }));

      // Convert to CSV
      const json2csvParser = new Parser({
        fields: [
          'Date', 'Vendor', 'Amount', 'Tax', 'HST', 'HST Reg#', 'Subtotal',
          'Category', 'Payment Method', 'Location', 'Personal Card', 'Notes',
          'Uploaded By', 'Upload Date', 'Reconciled'
        ]
      });
      // Add UTF-8 BOM so Excel correctly handles non-ASCII characters (accented vendor names, etc.)
      const csv = '\uFEFF' + json2csvParser.parse(csvData);

      // Set headers for download
      const filename = `receipts_${periodLabel}_${format(now, 'yyyyMMdd')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);

    } else if (exportFormat === 'json') {
      // Return raw JSON data
      const filename = `receipts_${periodLabel}_${format(now, 'yyyyMMdd')}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({
        exportDate: now.toISOString(),
        period: period,
        periodLabel: periodLabel,
        totalReceipts: receipts.length,
        receipts: receipts.map((r: any) => ({
          ...r,
          // Include or exclude image data based on parameter
          file_data: includePhotos === 'true' ? r.file_data : (r.file_data ? '[IMAGE DATA EXCLUDED]' : null)
        }))
      });

    } else if (exportFormat === 'zip') {
      // STREAMING EXPORT: Process photos in batches to handle 200+ receipts
      // No hard limit - uses batch processing to manage memory
      const BATCH_SIZE = 10; // Process 10 photos at a time to manage memory

      logger.info(`Starting streaming ZIP export for ${receipts.length} receipts`);

      // Create ZIP with receipts metadata and photos
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="receipts_${periodLabel}_${format(now, 'yyyyMMdd')}.zip"`);

      // Create archiver instance with balanced compression for better performance
      const archive = archiver('zip', {
        zlib: { level: 5 } // Slightly lower compression for faster streaming
      });

      // Handle archive errors
      archive.on('error', (err) => {
        logger.error('Archive creation error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });

      // Pipe archive data to response
      archive.pipe(res);

      // Get receipt IDs that have photos for batch processing
      const receiptIdsWithPhotos = receipts
        .filter((r: any) => r.file_data)
        .map((r: any) => r.id);

      // Add CSV metadata file (without file_data - already excluded in main query for CSV/JSON)
      const csvData = receipts.map((receipt: any) => ({
        'ID': receipt.id,
        'Date': format(new Date(receipt.purchase_date || receipt.created_at), 'yyyy-MM-dd'),
        'Vendor': receipt.vendor || '',
        'Amount': receipt.amount_cents ? (receipt.amount_cents / 100).toFixed(2) : '0.00',
        'Tax': receipt.tax_cents ? (receipt.tax_cents / 100).toFixed(2) : '0.00',
        'Category': receipt.category || '',
        'Payment Method': receipt.payment_method || '',
        'Location': receipt.club_location || '',
        'Personal Card': receipt.is_personal_card ? 'Yes' : 'No',
        'Notes': receipt.notes || '',
        'Uploaded By': receipt.uploader_name || '',
        'Upload Date': format(new Date(receipt.created_at), 'yyyy-MM-dd HH:mm'),
        'Has Photo': receiptIdsWithPhotos.includes(receipt.id) ? 'Yes' : 'No'
      }));

      const json2csvParser = new Parser({
        fields: [
          'ID', 'Date', 'Vendor', 'Amount', 'Tax', 'Category',
          'Payment Method', 'Location', 'Personal Card', 'Notes', 'Uploaded By',
          'Upload Date', 'Has Photo'
        ]
      });
      const csv = json2csvParser.parse(csvData);
      archive.append(csv, { name: 'receipts_metadata.csv' });

      // Add manifest JSON (will be updated with file info)
      const manifest: {
        exportDate: string;
        period: any;
        periodLabel: string;
        totalReceipts: number;
        receiptsWithPhotos: number;
        files: Array<{ receiptId: string; filename: string; size: number; mimeType: string }>;
      } = {
        exportDate: now.toISOString(),
        period: period,
        periodLabel: periodLabel,
        totalReceipts: receipts.length,
        receiptsWithPhotos: receiptIdsWithPhotos.length,
        files: []
      };

      // Process photos in batches using LIMIT/OFFSET queries
      let photoCount = 0;
      const totalPhotos = receiptIdsWithPhotos.length;

      for (let offset = 0; offset < totalPhotos; offset += BATCH_SIZE) {
        // Fetch batch of photos from database
        const batchIds = receiptIdsWithPhotos.slice(offset, offset + BATCH_SIZE);

        if (batchIds.length === 0) break;

        // Query only file_data for this batch (reduces memory per query)
        const batchQuery = `
          SELECT id, file_data, mime_type, vendor, purchase_date
          FROM receipts
          WHERE id = ANY($1) AND file_data IS NOT NULL
        `;
        const batchResult = await db.query(batchQuery, [batchIds]);

        // Process each receipt in the batch
        for (const receipt of batchResult.rows) {
          try {
            // Extract base64 data and file extension
            let base64Data = receipt.file_data;
            let mimeType = receipt.mime_type || 'image/jpeg';
            let extension = 'jpg';

            // Handle data URL format
            if (base64Data.includes(',')) {
              const parts = base64Data.split(',');
              base64Data = parts[1];
              if (parts[0].includes('image/png')) {
                extension = 'png';
                mimeType = 'image/png';
              } else if (parts[0].includes('application/pdf')) {
                extension = 'pdf';
                mimeType = 'application/pdf';
              }
            } else if (mimeType.includes('png')) {
              extension = 'png';
            } else if (mimeType.includes('pdf')) {
              extension = 'pdf';
            }

            // Create safe filename
            const vendor = (receipt.vendor || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const date = receipt.purchase_date ? format(new Date(receipt.purchase_date), 'yyyy-MM-dd') : 'no-date';
            const filename = `images/${receipt.id}_${vendor}_${date}.${extension}`;

            // Convert base64 to Buffer
            const buffer = Buffer.from(base64Data, 'base64');

            archive.append(buffer, { name: filename });

            manifest.files.push({
              receiptId: receipt.id,
              filename: filename,
              size: buffer.length,
              mimeType: mimeType
            });

            photoCount++;

            // Allow event loop to breathe every 5 photos to prevent blocking
            if (photoCount % 5 === 0) {
              await new Promise(resolve => setImmediate(resolve));
              logger.debug(`Processed ${photoCount} photos, allowing event loop to process other requests`);
            }
          } catch (err) {
            logger.error(`Failed to add photo for receipt ${receipt.id}:`, err);
          }
        }
      }

      // Add manifest file
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Finalize the archive
      archive.finalize();

      logger.info(`Created ZIP export with ${photoCount} photos out of ${receipts.length} receipts`);

    } else if (exportFormat === 'pdf') {
      // PDF export will be implemented in the next phase
      res.status(501).json({
        error: 'PDF export not yet implemented',
        message: 'Please use CSV, JSON, or ZIP format for now'
      });

    } else {
      res.status(400).json({
        error: 'Invalid export format',
        message: 'Supported formats: csv, json, zip, pdf'
      });
    }

  } catch (error) {
    logger.error('Error exporting receipts:', error);
    res.status(500).json({
      error: 'Failed to export receipts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/receipts/upload
 * Upload a receipt (simplified - using base64 like tickets)
 */
router.post('/upload',
  authenticate,
  uploadLimiter,
  [
    body('file_data').notEmpty().withMessage('File data is required'),
    body('file_name').notEmpty().withMessage('File name is required'),
    body('vendor').optional().trim(),
    body('amount_cents').optional().isInt(),
    body('purchase_date').optional().isISO8601(),
    body('club_location').optional().isIn(['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'Stratford', 'River Oaks']),
    body('is_personal_card').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { user } = req as any;

      // Check user role
      if (!['admin', 'staff', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to upload receipts'
        });
      }

      let {
        file_data,
        file_name,
        file_size,
        mime_type,
        vendor,
        amount_cents,
        purchase_date,
        club_location,
        notes,
        is_personal_card
      } = req.body;

      // Validate file size (5MB decoded limit — base64 inflates ~33%, so check at 7MB)
      if (file_data && file_data.length > 7_000_000) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 5MB limit'
        });
      }

      // Generate content hash for duplicate detection
      const contentHash = hash(file_data);

      // Check for existing receipt with same content
      const existingReceipt = await db.query(
        'SELECT id, vendor, created_at FROM receipts WHERE content_hash = $1',
        [contentHash]
      );

      if (existingReceipt.rows.length > 0) {
        const existing = existingReceipt.rows[0];
        logger.warn('Duplicate receipt detected', {
          existingId: existing.id,
          vendor: existing.vendor,
          uploadedAt: existing.created_at
        });
        return res.status(409).json({
          success: false,
          error: 'Duplicate receipt detected',
          message: `This receipt was already uploaded on ${new Date(existing.created_at).toLocaleDateString()}`,
          existingReceipt: {
            id: existing.id,
            vendor: existing.vendor,
            uploadedAt: existing.created_at
          }
        });
      }

      logger.info(`Receipt upload started by user ${user.id}`, {
        fileName: file_name,
        vendor,
        location: club_location
      });

      // Run OCR on images and PDFs
      let ocrResult = null;
      let ocrDisplayText = '';
      const isImage = mime_type && mime_type.startsWith('image/');
      const isPdf = mime_type === 'application/pdf' || file_name?.toLowerCase().endsWith('.pdf');

      if (isImage || isPdf) {
        logger.info(`Running OCR on receipt ${isPdf ? 'PDF' : 'image'}`);

        // Use processReceiptSmart for PDFs (Veryfi/GPT-4o), processReceiptWithOCR for images
        ocrResult = isPdf
          ? await processReceiptSmart(file_data)
          : await processReceiptWithOCR(file_data);
        ocrDisplayText = formatOCRForDisplay(ocrResult);

        // Use OCR data if manual data not provided
        if (!vendor && ocrResult.vendor) {
          vendor = ocrResult.vendor;
        }
        if (!amount_cents && ocrResult.totalAmount) {
          amount_cents = Math.round(ocrResult.totalAmount * 100);
        }
        if (!purchase_date && ocrResult.purchaseDate) {
          purchase_date = ocrResult.purchaseDate;
        }

        logger.info('OCR processing completed', {
          vendor: ocrResult.vendor,
          amount: ocrResult.totalAmount,
          confidence: ocrResult.confidence
        });
      }

      // Convert image to PDF for storage (OCR already ran on the original)
      // Content hash was computed on the original file_data above — do not recompute
      let storageData = file_data;
      let storageMimeType = mime_type || 'application/pdf';
      let storageFileName = file_name;

      if (isImage) {
        try {
          logger.info('Converting receipt image to PDF for storage');
          storageData = await convertImageToPdf(file_data);
          storageMimeType = 'application/pdf';
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

      // Create database record with OCR data and content hash
      const insertResult = await db.query(`
          INSERT INTO receipts (
            file_data,
            file_name,
            file_size,
            mime_type,
            vendor,
            amount_cents,
            tax_cents,
            hst_cents,
            hst_reg_number,
            purchase_date,
            club_location,
            category,
            payment_method,
            notes,
            uploader_user_id,
            ocr_status,
            ocr_text,
            ocr_json,
            ocr_confidence,
            line_items,
            is_personal_card,
            content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (content_hash) DO NOTHING
          RETURNING id, vendor, amount_cents, purchase_date, club_location, created_at, is_personal_card
        `, [
          storageData,
          storageFileName,
          file_size || null,
          storageMimeType,
          vendor || null,
          amount_cents ? parseInt(amount_cents.toString()) : null,
          ocrResult?.taxAmount ? Math.round(ocrResult.taxAmount * 100) : null,
          ocrResult?.hstAmount ? Math.round(ocrResult.hstAmount * 100) : null,
          ocrResult?.hstRegNumber || null,
          purchase_date || null,
          club_location || null,
          ocrResult?.category || null,
          ocrResult?.paymentMethod || null,
          notes || null,
          user.id,
          ocrResult ? 'completed' : 'manual',
          ocrResult?.rawText || null,
          ocrResult ? JSON.stringify(ocrResult) : null,
          ocrResult?.confidence || 0,
          ocrResult?.lineItems ? JSON.stringify(ocrResult.lineItems) : null,
          is_personal_card || false,
          contentHash
        ]);

      const receipt = insertResult.rows[0];

      // ON CONFLICT returns no rows if duplicate slipped past the SELECT check
      if (!receipt) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate receipt detected',
          message: 'This receipt was already uploaded'
        });
      }

      logger.info(`Receipt uploaded successfully`, {
        receiptId: receipt.id,
        vendor: receipt.vendor
      });

      res.json({
        success: true,
        data: {
          id: receipt.id,
          vendor: receipt.vendor,
          amount: receipt.amount_cents ? receipt.amount_cents / 100 : null,
          purchase_date: receipt.purchase_date,
          location: receipt.club_location,
          created_at: receipt.created_at,
          is_personal_card: receipt.is_personal_card || false,
          status: 'uploaded',
          // Include OCR results for frontend to display
          ocrResult: ocrResult,
          ocrDisplay: ocrDisplayText,
          ocrConfidence: ocrResult?.confidence || 0
        }
      });

    } catch (error: any) {
      logger.error('Receipt upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload receipt'
      });
    }
  }
);

/**
 * GET /api/receipts/search
 * Search receipts with filters
 */
router.get('/search',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const {
        q,
        vendor,
        date_from,
        date_to,
        location,
        reconciled,
        source,
        category,
        sort = 'created_at',
        dir = 'desc',
        page = 1,
        limit = 20
      } = req.query;

      // Check user role
      if (!['admin', 'staff', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      let queryStr = `
        SELECT
          r.id,
          r.file_name,
          r.vendor,
          r.amount_cents,
          r.purchase_date,
          r.club_location,
          r.ocr_status,
          r.reconciled,
          r.created_at,
          r.source,
          r.hst_cents,
          r.tax_cents,
          r.category,
          r.is_personal_card,
          u.name as uploader_name
        FROM receipts r
        LEFT JOIN users u ON r.uploader_user_id = u.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Search filter
      if (q) {
        queryStr += ` AND (
          r.vendor ILIKE $${paramIndex} OR
          r.file_name ILIKE $${paramIndex} OR
          r.notes ILIKE $${paramIndex}
        )`;
        params.push(`%${q}%`);
        paramIndex++;
      }

      // Vendor filter
      if (vendor) {
        queryStr += ` AND r.vendor ILIKE $${paramIndex}`;
        params.push(`%${vendor}%`);
        paramIndex++;
      }

      // Date range filter
      if (date_from) {
        queryStr += ` AND r.purchase_date >= $${paramIndex}`;
        params.push(date_from);
        paramIndex++;
      }

      if (date_to) {
        queryStr += ` AND r.purchase_date <= $${paramIndex}`;
        params.push(date_to);
        paramIndex++;
      }

      // Location filter
      if (location) {
        queryStr += ` AND r.club_location = $${paramIndex}`;
        params.push(location);
        paramIndex++;
      }

      // Reconciled filter
      if (reconciled !== undefined) {
        queryStr += ` AND r.reconciled = $${paramIndex}`;
        params.push(reconciled === 'true');
        paramIndex++;
      }

      // Source filter (gmail matches gmail_attachment and gmail_body via prefix)
      if (source) {
        if (source === 'gmail') {
          queryStr += ` AND r.source LIKE $${paramIndex}`;
          params.push('gmail%');
        } else {
          queryStr += ` AND r.source = $${paramIndex}`;
          params.push(source);
        }
        paramIndex++;
      }

      // Category filter
      if (category) {
        queryStr += ` AND r.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Save WHERE clause for count query before adding ORDER BY / LIMIT
      const whereClause = queryStr.substring(queryStr.indexOf('WHERE'));
      const countParams = [...params];

      // Add ordering with validated sort column (prevent SQL injection)
      const allowedSorts: Record<string, string> = {
        'created_at': 'r.created_at',
        'purchase_date': 'r.purchase_date',
        'vendor': 'r.vendor',
        'amount_cents': 'r.amount_cents',
      };
      const sortColumn = allowedSorts[sort as string] || 'r.created_at';
      const sortDirection = (dir as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      queryStr += ` ORDER BY ${sortColumn} ${sortDirection}`;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), offset);

      const result = await db.query(queryStr, params);

      // Get total count using the saved WHERE clause
      const countQuery = `SELECT COUNT(*) as total FROM receipts r LEFT JOIN users u ON r.uploader_user_id = u.id ${whereClause}`;
      const countResult = await db.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          receipts: result.rows.map((row: any) => ({
            ...row,
            amount: row.amount_cents ? row.amount_cents / 100 : null
          })),
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: parseInt(countResult.rows[0]?.total || '0'),
            totalPages: Math.ceil(parseInt(countResult.rows[0]?.total || '0') / parseInt(limit as string))
          }
        }
      });

    } catch (error) {
      logger.error('Receipt search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search receipts'
      });
    }
  }
);

/**
 * GET /api/receipts/:id
 * Get single receipt details
 */
router.get('/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ success: false, error: 'Invalid receipt ID format' });
      }

      // Check user role
      if (!['admin', 'staff', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const result = await db.query(`
        SELECT
          r.*,
          u.name as uploader_name
        FROM receipts r
        LEFT JOIN users u ON r.uploader_user_id = u.id
        WHERE r.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found'
        });
      }

      const receipt = result.rows[0];

      res.json({
        success: true,
        data: {
          ...receipt,
          amount: receipt.amount_cents ? receipt.amount_cents / 100 : null
        }
      });

    } catch (error) {
      logger.error('Get receipt error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve receipt'
      });
    }
  }
);

/**
 * PATCH /api/receipts/:id
 * Update receipt metadata
 */
router.patch('/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      const updates = req.body;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ success: false, error: 'Invalid receipt ID format' });
      }

      // Check user role
      if (!['admin', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to update receipts'
        });
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      const allowedFields = [
        'vendor',
        'amount_cents',
        'purchase_date',
        'club_location',
        'notes',
        'category',
        'reconciled'
      ];

      for (const field of allowedFields) {
        if (field in updates) {
          updateFields.push(`${field} = $${paramIndex}`);
          params.push(updates[field]);
          paramIndex++;
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }

      // Add updated_at
      updateFields.push(`updated_at = NOW()`);

      // Handle reconciliation
      if (updates.reconciled === true) {
        updateFields.push(`reconciled_at = NOW()`);
        updateFields.push(`reconciled_by = $${paramIndex}`);
        params.push(user.id);
        paramIndex++;
      } else if (updates.reconciled === false) {
        updateFields.push('reconciled_at = NULL');
        updateFields.push('reconciled_by = NULL');
      }

      // Add receipt ID for WHERE clause
      params.push(id);

      const queryStr = `
        UPDATE receipts
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await db.query(queryStr, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found'
        });
      }

      // Log the update
      await db.query(`
        INSERT INTO receipt_audit_log (receipt_id, action, changed_fields, user_id)
        VALUES ($1, 'update', $2, $3)
      `, [id, JSON.stringify(updates), user.id]);

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          amount: result.rows[0].amount_cents ? result.rows[0].amount_cents / 100 : null
        }
      });

    } catch (error) {
      logger.error('Update receipt error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update receipt'
      });
    }
  }
);

/**
 * DELETE /api/receipts/:id
 * Delete a receipt
 */
router.delete('/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;

      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ success: false, error: 'Invalid receipt ID format' });
      }

      // Only admin can delete
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can delete receipts'
        });
      }

      // Delete first, then log only if receipt existed
      const result = await db.query(
        'DELETE FROM receipts WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found'
        });
      }

      // Log after confirmed deletion
      await db.query(`
        INSERT INTO receipt_audit_log (receipt_id, action, user_id)
        VALUES ($1, 'delete', $2)
      `, [id, user.id]);

      res.json({
        success: true,
        message: 'Receipt deleted successfully'
      });

    } catch (error) {
      logger.error('Delete receipt error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete receipt'
      });
    }
  }
);

/**
 * POST /api/receipts/reconcile
 * Mark multiple receipts as reconciled
 */
router.post('/reconcile',
  authenticate,
  [
    body('receiptIds').isArray().withMessage('Receipt IDs must be an array'),
    body('receiptIds.*').isUUID().withMessage('Invalid receipt ID')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { user } = req as any;
      const { receiptIds } = req.body;

      // Check user role
      if (!['admin', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      if (receiptIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No receipts to reconcile'
        });
      }

      // Update all receipts
      const placeholders = receiptIds.map((_: any, i: number) => `$${i + 2}`).join(', ');
      const queryStr = `
        UPDATE receipts
        SET
          reconciled = true,
          reconciled_at = NOW(),
          reconciled_by = $1,
          updated_at = NOW()
        WHERE id IN (${placeholders})
        AND reconciled = false
        RETURNING id
      `;

      const params = [user.id, ...receiptIds];
      const result = await db.query(queryStr, params);

      // Log the reconciliation
      for (const receiptId of result.rows) {
        await db.query(`
          INSERT INTO receipt_audit_log (receipt_id, action, changed_fields, user_id)
          VALUES ($1, 'reconcile', $2, $3)
        `, [receiptId.id, JSON.stringify({ reconciled: true }), user.id]);
      }

      res.json({
        success: true,
        data: {
          reconciledCount: result.rows.length,
          receiptIds: result.rows.map((r: any) => r.id)
        }
      });

    } catch (error) {
      logger.error('Reconcile receipts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reconcile receipts'
      });
    }
  }
);

export default router;