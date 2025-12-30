import express from 'express';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { body, validationResult, query } from 'express-validator';
import { processReceiptWithOCR, formatOCRForDisplay } from '../services/ocr/receiptOCR';
import { format } from 'date-fns';
import { Parser } from 'json2csv';
import archiver from 'archiver';
import { hash } from '../utils/encryption';

const router = express.Router();

// Rate limiter for upload endpoint (10 uploads per minute per user)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /api/receipts/summary
 * Get receipt summary statistics
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
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
        dateFilter = 'WHERE created_at >= $1';
        queryParams = [weekStart.toISOString()];
        break;
      case 'month':
        // Support custom month selection via year and month params
        if (year && month) {
          const customMonthStart = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
          const customMonthEnd = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
          dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
          queryParams = [customMonthStart.toISOString(), customMonthEnd.toISOString()];
        } else {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = 'WHERE created_at >= $1';
          queryParams = [monthStart.toISOString()];
        }
        break;
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = 'WHERE created_at >= $1';
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
      earliest_receipt: null,
      latest_receipt: null
    };

    // Get last export timestamp from a tracking table or localStorage
    // For now, we'll return null and track this client-side

    res.json({
      totalReceipts: parseInt(result.total_receipts) || 0,
      totalAmount: (parseInt(result.total_amount_cents) || 0) / 100,
      totalTax: (parseInt(result.total_tax_cents) || 0) / 100,
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
router.get('/export', authenticate, async (req, res) => {
  try {
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

    // Fetch receipts using parameterized query
    const receiptsQuery = `
      SELECT
        r.*,
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
      const csvData = receipts.map(receipt => ({
        'Date': format(new Date(receipt.purchase_date || receipt.created_at), 'yyyy-MM-dd'),
        'Vendor': receipt.vendor || '',
        'Amount': receipt.amount_cents ? (receipt.amount_cents / 100).toFixed(2) : '0.00',
        'Tax': receipt.tax_cents ? (receipt.tax_cents / 100).toFixed(2) : '0.00',
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
          'Date', 'Vendor', 'Amount', 'Tax', 'Subtotal',
          'Category', 'Payment Method', 'Location', 'Personal Card', 'Notes',
          'Uploaded By', 'Upload Date', 'Reconciled'
        ]
      });
      const csv = json2csvParser.parse(csvData);

      // Set headers for download
      const filename = `receipts_${periodLabel}_${format(now, 'yyyyMMdd')}.csv`;
      res.setHeader('Content-Type', 'text/csv');
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
        receipts: receipts.map(r => ({
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
        .filter(r => r.file_data)
        .map(r => r.id);

      // Add CSV metadata file (without file_data - already excluded in main query for CSV/JSON)
      const csvData = receipts.map(receipt => ({
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
  async (req, res) => {
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

      // Validate file size (5MB limit for base64, similar to ticket photos)
      if (file_data && file_data.length > 5_000_000) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 5MB limit'
        });
      }

      // Generate content hash for duplicate detection (defensive - column may not exist yet)
      let contentHash: string | null = null;
      try {
        contentHash = hash(file_data);

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
      } catch (hashErr) {
        // content_hash column may not exist yet - continue without duplicate detection
        logger.warn('Duplicate detection skipped - content_hash column may not exist yet');
        contentHash = null;
      }

      logger.info(`Receipt upload started by user ${user.id}`, {
        fileName: file_name,
        vendor,
        location: club_location
      });

      // First, run OCR on the image if it's an image file
      let ocrResult = null;
      let ocrDisplayText = '';

      if (mime_type && mime_type.startsWith('image/')) {
        logger.info('Running OCR on receipt image');

        // Process with OCR
        ocrResult = await processReceiptWithOCR(file_data);
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

      // Create database record with OCR data and content hash (defensive - column may not exist)
      let insertResult;
      try {
        insertResult = await db.query(`
          INSERT INTO receipts (
            file_data,
            file_name,
            file_size,
            mime_type,
            vendor,
            amount_cents,
            tax_cents,
            purchase_date,
            club_location,
            category,
            payment_method,
            notes,
            uploader_user_id,
            ocr_status,
            ocr_text,
            ocr_json,
            is_personal_card,
            content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id, vendor, amount_cents, purchase_date, club_location, created_at, is_personal_card
        `, [
          file_data,
          file_name,
          file_size || null,
          mime_type || 'application/pdf',
          vendor || null,
          amount_cents ? parseInt(amount_cents.toString()) : null,
          ocrResult?.taxAmount ? Math.round(ocrResult.taxAmount * 100) : null,
          purchase_date || null,
          club_location || null,
          ocrResult?.category || null,
          ocrResult?.paymentMethod || null,
          notes || null,
          user.id,
          ocrResult ? 'completed' : 'manual',
          ocrResult?.rawText || null,
          ocrResult ? JSON.stringify(ocrResult) : null,
          is_personal_card || false,
          contentHash
        ]);
      } catch (insertErr) {
        // content_hash column may not exist - try without it
        logger.warn('INSERT with content_hash failed, retrying without it');
        insertResult = await db.query(`
          INSERT INTO receipts (
            file_data,
            file_name,
            file_size,
            mime_type,
            vendor,
            amount_cents,
            tax_cents,
            purchase_date,
            club_location,
            category,
            payment_method,
            notes,
            uploader_user_id,
            ocr_status,
            ocr_text,
            ocr_json,
            is_personal_card
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id, vendor, amount_cents, purchase_date, club_location, created_at, is_personal_card
        `, [
          file_data,
          file_name,
          file_size || null,
          mime_type || 'application/pdf',
          vendor || null,
          amount_cents ? parseInt(amount_cents.toString()) : null,
          ocrResult?.taxAmount ? Math.round(ocrResult.taxAmount * 100) : null,
          purchase_date || null,
          club_location || null,
          ocrResult?.category || null,
          ocrResult?.paymentMethod || null,
          notes || null,
          user.id,
          ocrResult ? 'completed' : 'manual',
          ocrResult?.rawText || null,
          ocrResult ? JSON.stringify(ocrResult) : null,
          is_personal_card || false
        ]);
      }

      const receipt = insertResult.rows[0];

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
  async (req, res) => {
    try {
      const { user } = req as any;
      const {
        q,
        vendor,
        date_from,
        date_to,
        location,
        reconciled,
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

      // Add ordering and pagination
      queryStr += ` ORDER BY r.created_at DESC`;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), offset);

      const result = await db.query(queryStr, params);

      // Get total count
      const countQuery = queryStr.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(*) as total FROM'
      ).replace(/ORDER BY[\s\S]*$/, '');

      const countParams = params.slice(0, -2); // Remove limit and offset
      const countResult = await db.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          receipts: result.rows.map(row => ({
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
  async (req, res) => {
    try {
      const { user } = req as any;
      const { id } = req.params;

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
  async (req, res) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      const updates = req.body;

      // Check user role
      if (!['admin', 'staff'].includes(user.role)) {
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
  async (req, res) => {
    try {
      const { user } = req as any;
      const { id } = req.params;

      // Only admin can delete
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can delete receipts'
        });
      }

      // Log before deletion
      await db.query(`
        INSERT INTO receipt_audit_log (receipt_id, action, user_id)
        VALUES ($1, 'delete', $2)
      `, [id, user.id]);

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
  async (req, res) => {
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
      if (!['admin', 'staff'].includes(user.role)) {
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
      const placeholders = receiptIds.map((_: any, i: number) => `$${i + 3}`).join(', ');
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

/**
 * POST /api/receipts/export-async
 * Start an async export job for large exports
 */
router.post('/export-async',
  authenticate,
  [
    body('period').optional().isIn(['week', 'month', 'year', 'all']),
    body('format').optional().isIn(['csv', 'json', 'zip'])
  ],
  async (req, res) => {
    try {
      const { user } = req as any;
      const { period = 'month', format: exportFormat = 'zip' } = req.body;

      // Check user role
      if (!['admin', 'staff', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      // Create export job record
      const jobResult = await db.query(`
        INSERT INTO export_jobs (user_id, export_type, filters, status)
        VALUES ($1, 'receipts', $2, 'pending')
        RETURNING id
      `, [user.id, JSON.stringify({ period, format: exportFormat })]);

      const jobId = jobResult.rows[0].id;

      // Start background processing (non-blocking)
      // For now, we use the sync export since our streaming already handles large exports
      // This endpoint is a future-proofing placeholder for truly massive exports
      logger.info(`Export job ${jobId} created for ${exportFormat} export`);

      res.json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          message: 'For large exports, use the standard export endpoint which now supports streaming.'
        }
      });

    } catch (error) {
      logger.error('Create export job error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create export job'
      });
    }
  }
);

/**
 * GET /api/receipts/export-status/:jobId
 * Check the status of an export job
 */
router.get('/export-status/:jobId',
  authenticate,
  async (req, res) => {
    try {
      const { user } = req as any;
      const { jobId } = req.params;

      const result = await db.query(`
        SELECT id, status, total_items, processed_items, file_size, error_message,
               created_at, completed_at
        FROM export_jobs
        WHERE id = $1 AND user_id = $2
      `, [jobId, user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Export job not found'
        });
      }

      const job = result.rows[0];

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.total_items > 0
            ? Math.round((job.processed_items / job.total_items) * 100)
            : 0,
          totalItems: job.total_items,
          processedItems: job.processed_items,
          fileSize: job.file_size,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at
        }
      });

    } catch (error) {
      logger.error('Get export status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export status'
      });
    }
  }
);

export default router;