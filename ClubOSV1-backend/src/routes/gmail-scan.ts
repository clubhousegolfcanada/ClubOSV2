import express from 'express';
import { authenticate } from '../middleware/auth';
import { runGmailScan } from '../services/gmail/gmailReceiptScanner';
import { isVeryfiConfigured } from '../services/ocr/veryfiOCR';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

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
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Gmail scan failed:', error);
    return res.status(500).json({ error: 'Gmail scan failed' });
  }
});

/**
 * GET /api/gmail/status
 * Get Gmail scanning statistics
 */
router.get('/status', authenticate, async (req, res) => {
  const { user } = req as any;
  if (!['admin', 'operator'].includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    // Count actual receipts in the receipts table (not gmail_scanned_messages which can be stale)
    const receiptCount = await db.query(`SELECT COUNT(*) as count FROM receipts WHERE source LIKE 'gmail%'`);
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_scanned,
        MAX(processed_at) as last_scan_at,
        COUNT(DISTINCT from_address) as unique_senders
      FROM gmail_scanned_messages
    `);

    const recentSenders = await db.query(`
      SELECT from_address, COUNT(*) as count, SUM(receipts_created) as receipts
      FROM gmail_scanned_messages
      WHERE receipts_created > 0
      GROUP BY from_address
      ORDER BY receipts DESC
      LIMIT 20
    `);

    const row = stats.rows[0];
    return res.json({
      success: true,
      data: {
        totalScanned: parseInt(row.total_scanned || '0'),
        totalReceipts: parseInt(receiptCount.rows[0]?.count || '0'),
        lastScanTime: row.last_scan_at,
        uniqueSenders: parseInt(row.unique_senders || '0'),
        ocrProvider: isVeryfiConfigured() ? 'veryfi' : 'gpt-4o',
        gmailEnabled: process.env.GMAIL_SCAN_ENABLED === 'true',
        topSenders: recentSenders.rows,
      }
    });
  } catch (error) {
    logger.error('Gmail status error:', error);
    return res.status(500).json({ error: 'Failed to get Gmail status' });
  }
});

/**
 * POST /api/gmail/reset-stale
 * Reset messages that were marked processed but have no actual receipts in DB.
 * This allows re-scanning of messages that failed during the content_hash bug.
 */
router.post('/reset-stale', authenticate, async (req, res) => {
  const { user } = req as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    // Find messages marked as processed with receipts_created > 0
    // but that don't have matching receipts in the receipts table
    const result = await db.query(`
      DELETE FROM gmail_scanned_messages gsm
      WHERE gsm.receipts_created > 0
      AND NOT EXISTS (
        SELECT 1 FROM receipts r WHERE r.gmail_message_id = gsm.message_id
      )
      RETURNING gsm.message_id, gsm.subject
    `);

    // Also delete messages with receipts_created = 0 that might have had processable content
    // (from before the insertsAttempted fix)
    const result2 = await db.query(`
      DELETE FROM gmail_scanned_messages gsm
      WHERE gsm.receipts_created = 0
      AND gsm.attachment_count > 0
      RETURNING gsm.message_id
    `);

    const resetCount = result.rows.length + result2.rows.length;
    logger.info(`Reset ${resetCount} stale gmail_scanned_messages records`, {
      falsePositives: result.rows.length,
      zeroWithAttachments: result2.rows.length,
    });

    return res.json({
      success: true,
      data: {
        resetCount,
        falsePositives: result.rows.length,
        zeroWithAttachments: result2.rows.length,
        message: `Reset ${resetCount} stale records. Run a scan to re-process them.`
      }
    });
  } catch (error) {
    logger.error('Reset stale failed:', error);
    return res.status(500).json({ error: 'Failed to reset stale records' });
  }
});

export default router;
