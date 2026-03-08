import express from 'express';
import { authenticate } from '../middleware/auth';
import { runGmailScan } from '../services/gmail/gmailReceiptScanner';
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
  if (!['admin', 'operator'].includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_scanned,
        COALESCE(SUM(receipts_created), 0) as total_receipts_created,
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
