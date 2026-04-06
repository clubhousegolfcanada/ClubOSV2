/**
 * Bank Statement Import Routes
 *
 * Upload RBC bank statement PDFs, parse via the embedded Python parsers
 * (called via child_process), and import transactions into ClubOS.
 */

import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { parseBankStatement, checkParserAvailability } from '../services/bank-parser/bankStatementParser';

const router = express.Router();

const ACCOUNT_LABELS: Record<string, string> = {
  'chequing_1908': 'General Account (1908)',
  'chequing_0551': 'Build Account (0551)',
  'tax_holding_0700': 'Tax Holding (0700)',
  'visa_7542': 'Visa - Nick (7542)',
  'visa_8407': 'Visa - Michael (8407)',
};

/**
 * POST /api/bank-statements/parse
 * Upload a bank statement PDF, parse it, return preview of transactions.
 * Does NOT import yet — user confirms first.
 */
router.post('/parse', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (!['admin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { file_data, file_name, account } = req.body;
    if (!file_data || !file_name) {
      return res.status(400).json({ success: false, error: 'file_data and file_name required' });
    }

    // Check if this PDF was already imported
    const fileHashRaw = require('crypto').createHash('sha256')
      .update(Buffer.from(file_data.replace(/^data:application\/pdf;base64,/, ''), 'base64'))
      .digest('hex').slice(0, 16);

    const existing = await db.query(
      'SELECT COUNT(*) as count FROM bank_transactions WHERE source_pdf_hash = $1',
      [fileHashRaw]
    );
    if (parseInt(existing.rows[0].count) > 0) {
      return res.json({
        success: true,
        data: {
          alreadyImported: true,
          fileHash: fileHashRaw,
          message: 'This statement was already imported.',
          existingCount: parseInt(existing.rows[0].count),
        }
      });
    }

    // Parse via embedded Python parser (no external service needed)
    logger.info(`Parsing bank statement: ${file_name}`);
    const result = await parseBankStatement(file_data, file_name, account || undefined);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error || 'Failed to parse statement'
      });
    }

    // Auto-match transactions against existing receipts
    const transactions: any[] = result.transactions || [];
    for (const txn of transactions) {
      // Try to find a receipt with same amount and date (within 3 days)
      const amount = txn.debit ? Math.round(txn.debit * 100) : null;
      if (amount) {
        const match = await db.query(`
          SELECT id, vendor, purchase_date, amount_cents FROM receipts
          WHERE amount_cents BETWEEN $1 AND $2
          AND purchase_date BETWEEN ($3::date - interval '3 days') AND ($3::date + interval '3 days')
          LIMIT 1
        `, [amount - 50, amount + 50, txn.txn_date]);
        if (match.rows.length > 0) {
          txn.matched_receipt = match.rows[0];
        }
      }
    }

    return res.json({
      success: true,
      data: {
        account: result.account,
        accountLabel: ACCOUNT_LABELS[result.account] || result.account,
        accountType: result.account_type,
        fileHash: result.file_hash,
        statementStart: result.statement_start,
        statementEnd: result.statement_end,
        transactionCount: result.transaction_count,
        transactions: transactions.map((t: any) => ({
          txnId: t.txn_id,
          date: t.txn_date,
          description: t.description,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
          currency: t.currency,
          matchedReceipt: t.matched_receipt || null,
        })),
        validation: result.validation,
      }
    });
  } catch (error: any) {
    logger.error('Bank statement parse error:', error);
    return res.status(500).json({ success: false, error: 'Failed to parse bank statement' });
  }
});

/**
 * POST /api/bank-statements/import
 * Confirm and import parsed transactions into the database.
 */
router.post('/import', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (!['admin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { transactions, fileHash, account } = req.body;
    if (!transactions || !Array.isArray(transactions) || !fileHash) {
      return res.status(400).json({ success: false, error: 'transactions array and fileHash required' });
    }

    let imported = 0;
    let skipped = 0;
    let autoReconciled = 0;
    const unmatchedDebits: Array<{ txnId: string; date: string; description: string; amount: number }> = [];

    for (const txn of transactions) {
      const matchedReceiptId = txn.matchedReceipt?.id || txn.matched_receipt_id || null;

      const result = await db.query(`
        INSERT INTO bank_transactions (
          txn_id, account, card, txn_date, posting_date, description,
          debit, credit, balance, currency, fx_rate, cad_amount,
          visa_ref, source_pdf_hash, matched_receipt_id, imported_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (txn_id) DO NOTHING
        RETURNING txn_id
      `, [
        txn.txnId || txn.txn_id,
        account || txn.account,
        txn.card || null,
        txn.date || txn.txn_date,
        txn.posting_date || null,
        txn.description,
        txn.debit ? Math.round(txn.debit * 100) : null,
        txn.credit ? Math.round(txn.credit * 100) : null,
        txn.balance ? Math.round(txn.balance * 100) : null,
        txn.currency || 'CAD',
        txn.fx_rate || null,
        txn.cad_amount ? Math.round(txn.cad_amount * 100) : null,
        txn.visa_ref || null,
        fileHash,
        matchedReceiptId,
        user.id,
      ]);

      if (result.rows.length > 0) {
        imported++;

        // Auto-reconcile matched receipts
        if (matchedReceiptId) {
          try {
            const reconcileResult = await db.query(`
              UPDATE receipts SET reconciled = true, reconciled_at = NOW(), reconciled_by = $1, updated_at = NOW()
              WHERE id = $2 AND (reconciled = false OR reconciled IS NULL)
            `, [user.id, matchedReceiptId]);
            if (reconcileResult.rowCount && reconcileResult.rowCount > 0) autoReconciled++;
          } catch (_) { /* best effort */ }
        }

        // Track unmatched debits for the response
        if (!matchedReceiptId && txn.debit) {
          unmatchedDebits.push({
            txnId: txn.txnId || txn.txn_id,
            date: txn.date || txn.txn_date,
            description: txn.description,
            amount: txn.debit,
          });
        }
      } else {
        skipped++;
      }
    }

    logger.info(`Bank statement imported: ${imported} transactions, ${skipped} duplicates, ${autoReconciled} auto-reconciled`, {
      fileHash, account, userId: user.id
    });

    return res.json({
      success: true,
      data: {
        imported,
        skipped,
        autoReconciled,
        total: transactions.length,
        unmatchedDebits: unmatchedDebits.sort((a, b) => b.amount - a.amount).slice(0, 20),
      }
    });
  } catch (error: any) {
    logger.error('Bank statement import error:', error);
    return res.status(500).json({ success: false, error: 'Failed to import transactions' });
  }
});

/**
 * GET /api/bank-statements/transactions
 * List imported bank transactions with optional filters.
 */
router.get('/transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    if (!['admin', 'operator'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const { account, date_from, date_to, unmatched, page = 1, limit = 50 } = req.query;

    let queryStr = 'SELECT * FROM bank_transactions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (account) {
      queryStr += ` AND account = $${paramIndex}`;
      params.push(account);
      paramIndex++;
    }
    if (date_from) {
      queryStr += ` AND txn_date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      queryStr += ` AND txn_date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    if (unmatched === 'true') {
      queryStr += ' AND matched_receipt_id IS NULL';
    }

    const countResult = await db.query(
      queryStr.replace('SELECT *', 'SELECT COUNT(*) as total'),
      params
    );

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    queryStr += ` ORDER BY txn_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), offset);

    const result = await db.query(queryStr, params);

    return res.json({
      success: true,
      data: {
        transactions: result.rows.map((t: any) => ({
          ...t,
          debit: t.debit ? t.debit / 100 : null,
          credit: t.credit ? t.credit / 100 : null,
          balance: t.balance ? t.balance / 100 : null,
          cad_amount: t.cad_amount ? t.cad_amount / 100 : null,
        })),
        pagination: {
          total: parseInt(countResult.rows[0]?.total || '0'),
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        }
      }
    });
  } catch (error: any) {
    logger.error('Bank transactions query error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

/**
 * GET /api/bank-statements/parser-status
 * Check if the Python parser is available on this system.
 */
router.get('/parser-status', authenticate, async (_req: Request, res: Response) => {
  const status = await checkParserAvailability();
  return res.json({ success: true, data: status });
});

export default router;
