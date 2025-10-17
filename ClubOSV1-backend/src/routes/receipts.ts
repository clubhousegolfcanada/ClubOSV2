import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { db } from '../utils/database';
import { ReceiptDriveUploader } from '../services/googleDrive/receiptUploader';
import { ocrQueue } from '../workers/queues';
import logger from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDFs and images
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images (JPEG, PNG) are allowed.'));
    }
  }
});

// Rate limiter for upload endpoint (10 uploads per minute per user)
const uploadLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many uploads. Please try again later.'
});

// Initialize services
const driveUploader = new ReceiptDriveUploader();

/**
 * POST /api/receipts/upload
 * Upload a receipt file to Google Drive and queue for OCR
 */
router.post('/upload',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      const { user } = req as any;

      // Check user role
      if (!['admin', 'staff', 'operator'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to upload receipts'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const file = req.file;
      const metadata = req.body;

      logger.info(`Receipt upload started by user ${user.id}`, {
        fileName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      });

      // Calculate file hash for deduplication
      const hash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      // Check for duplicate
      const existingReceipt = await db.query(
        'SELECT id, file_id, drive_link FROM receipts WHERE content_hash = $1',
        [hash]
      );

      if (existingReceipt.rows.length > 0) {
        logger.info('Duplicate receipt detected', { hash });
        return res.json({
          success: true,
          data: {
            id: existingReceipt.rows[0].id,
            fileId: existingReceipt.rows[0].file_id,
            driveLink: existingReceipt.rows[0].drive_link,
            message: 'Receipt already uploaded',
            duplicate: true
          }
        });
      }

      // Upload to Google Drive
      const driveFile = await driveUploader.upload(file.buffer, {
        fileName: file.originalname,
        mimeType: file.mimetype,
        vendor: metadata.vendor,
        amount: metadata.amount_cents,
        location: metadata.club_location,
        uploaderId: user.id
      });

      // Create database record
      const insertResult = await db.query(`
        INSERT INTO receipts (
          file_id,
          file_name,
          file_size,
          mime_type,
          content_hash,
          drive_link,
          vendor,
          amount_cents,
          purchase_date,
          club_location,
          notes,
          uploader_user_id,
          ocr_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
        RETURNING id
      `, [
        driveFile.id,
        file.originalname,
        file.size,
        file.mimetype,
        hash,
        driveFile.webViewLink,
        metadata.vendor || null,
        metadata.amount_cents ? parseInt(metadata.amount_cents) : null,
        metadata.purchase_date || null,
        metadata.club_location || null,
        metadata.notes || null,
        user.id
      ]);

      const receiptId = insertResult.rows[0].id;

      // Queue OCR processing
      await ocrQueue.add('process-receipt', {
        receiptId,
        fileId: driveFile.id,
        fileName: file.originalname,
        retryCount: 0
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });

      logger.info(`Receipt uploaded successfully`, {
        receiptId,
        fileId: driveFile.id
      });

      res.json({
        success: true,
        data: {
          id: receiptId,
          fileId: driveFile.id,
          driveLink: driveFile.webViewLink,
          status: 'processing'
        }
      });

    } catch (error: any) {
      logger.error('Receipt upload error:', error);

      // Handle specific multer errors
      if (error.message?.includes('File too large')) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 10MB limit'
        });
      }

      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

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
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { user } = req as any;
    const {
      q,
      vendor,
      date_from,
      date_to,
      location,
      status,
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

    let query = `
      SELECT
        r.id,
        r.file_id,
        r.file_name,
        r.vendor,
        r.amount_cents,
        r.purchase_date,
        r.club_location,
        r.ocr_status,
        r.ocr_confidence,
        r.drive_link,
        r.created_at,
        r.reconciled,
        u.name as uploader_name
      FROM receipts r
      LEFT JOIN users u ON r.uploader_user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Full-text search
    if (q) {
      query += ` AND (
        r.vendor ILIKE $${paramIndex} OR
        r.ocr_text ILIKE $${paramIndex} OR
        r.file_name ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Vendor filter
    if (vendor) {
      query += ` AND r.vendor ILIKE $${paramIndex}`;
      params.push(`%${vendor}%`);
      paramIndex++;
    }

    // Date range filter
    if (date_from) {
      query += ` AND r.purchase_date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      query += ` AND r.purchase_date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    // Location filter
    if (location) {
      query += ` AND r.club_location = $${paramIndex}`;
      params.push(location);
      paramIndex++;
    }

    // OCR status filter
    if (status) {
      query += ` AND r.ocr_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY r.created_at DESC`;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await db.query(query, params);

    // Get total count
    const countQuery = query.replace(
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
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit as string))
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
});

/**
 * GET /api/receipts/:id
 * Get single receipt details
 */
router.get('/:id', requireAuth, async (req, res) => {
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
});

/**
 * GET /api/receipts/:id/status
 * Get OCR processing status for a receipt
 */
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const { user } = req as any;
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        id,
        ocr_status,
        ocr_json,
        ocr_confidence,
        ocr_processed_at
      FROM receipts
      WHERE id = $1
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
        id: receipt.id,
        status: receipt.ocr_status,
        extractedFields: receipt.ocr_json,
        confidence: receipt.ocr_confidence,
        processedAt: receipt.ocr_processed_at
      }
    });

  } catch (error) {
    logger.error('Get receipt status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve receipt status'
    });
  }
});

/**
 * PATCH /api/receipts/:id
 * Update receipt metadata
 */
router.patch('/:id', requireAuth, async (req, res) => {
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

    // Add receipt ID for WHERE clause
    params.push(id);

    const query = `
      UPDATE receipts
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);

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
      data: result.rows[0]
    });

  } catch (error) {
    logger.error('Update receipt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update receipt'
    });
  }
});

/**
 * POST /api/receipts/reconcile
 * Mark multiple receipts as reconciled
 */
router.post('/reconcile', requireAuth, async (req, res) => {
  try {
    const { user } = req as any;
    const { receiptIds, xeroReference } = req.body;

    // Check user role
    if (!['admin', 'staff'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt IDs'
      });
    }

    // Update all receipts
    const placeholders = receiptIds.map((_, i) => `$${i + 3}`).join(', ');
    const query = `
      UPDATE receipts
      SET
        reconciled = true,
        reconciled_at = NOW(),
        reconciled_by = $1,
        xero_reference = $2
      WHERE id IN (${placeholders})
      RETURNING id
    `;

    const params = [user.id, xeroReference, ...receiptIds];
    const result = await db.query(query, params);

    // Log the reconciliation
    for (const receiptId of receiptIds) {
      await db.query(`
        INSERT INTO receipt_audit_log (receipt_id, action, changed_fields, user_id)
        VALUES ($1, 'reconcile', $2, $3)
      `, [receiptId, JSON.stringify({ reconciled: true, xeroReference }), user.id]);
    }

    res.json({
      success: true,
      data: {
        reconciledCount: result.rows.length,
        receiptIds: result.rows.map(r => r.id)
      }
    });

  } catch (error) {
    logger.error('Reconcile receipts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reconcile receipts'
    });
  }
});

export default router;