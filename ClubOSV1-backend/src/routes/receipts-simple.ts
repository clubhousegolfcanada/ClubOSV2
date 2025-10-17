import express from 'express';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { body, validationResult, query } from 'express-validator';
import { processReceiptWithOCR, formatOCRForDisplay } from '../services/ocr/receiptOCR';

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
    body('club_location').optional().isIn(['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'Stratford', 'River Oaks'])
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
        notes
      } = req.body;

      // Validate file size (5MB limit for base64, similar to ticket photos)
      if (file_data && file_data.length > 5_000_000) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 5MB limit'
        });
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

      // Create database record with OCR data
      const insertResult = await db.query(`
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
          ocr_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, vendor, amount_cents, purchase_date, club_location, created_at
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
        ocrResult ? JSON.stringify(ocrResult) : null
      ]);

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

export default router;