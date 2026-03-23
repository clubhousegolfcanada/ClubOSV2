/**
 * Bank Statement Parser — Node.js wrapper
 *
 * Calls the Python RBC parsers (extract_chequing.py, extract_visa.py)
 * via child_process. No separate Python server needed.
 *
 * Requires: python3 + pdfplumber installed on the system.
 */

import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

const PARSER_SCRIPT = join(__dirname, 'parse_statement.py');
const PYTHON_BIN = process.env.PYTHON_PATH || 'python3';
const PARSE_TIMEOUT = 60_000; // 60 seconds

export interface BankTransaction {
  txn_id: string;
  account: string;
  card: string | null;
  txn_date: string;
  posting_date: string | null;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  currency: string;
  fx_rate: number | null;
  cad_amount: number | null;
  visa_ref: string | null;
  source_pdf_hash: string;
}

export interface ParseResult {
  success: boolean;
  account: string;
  account_type: 'chequing' | 'visa';
  statement_start: string | null;
  statement_end: string | null;
  transaction_count: number;
  transactions: BankTransaction[];
  validation: { passed: boolean; errors?: string[] };
  summary: Record<string, any>;
  file_hash?: string;
  error?: string;
}

/**
 * Parse a bank statement PDF.
 * Writes the base64 PDF to a temp file, calls Python, returns JSON.
 */
export async function parseBankStatement(
  base64Data: string,
  _fileName: string,
  account?: string
): Promise<ParseResult> {
  // Strip data URL prefix if present
  const rawBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
  const pdfBuffer = Buffer.from(rawBase64, 'base64');

  // Write to temp file
  const tmpPath = join(tmpdir(), `bank-statement-${randomUUID()}.pdf`);
  await writeFile(tmpPath, pdfBuffer);

  try {
    const args = [PARSER_SCRIPT, tmpPath];
    if (account) args.push(account);

    const result = await new Promise<string>((resolve, reject) => {
      execFile(PYTHON_BIN, args, {
        timeout: PARSE_TIMEOUT,
        maxBuffer: 50 * 1024 * 1024, // 50MB for large statements
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      }, (error, stdout, stderr) => {
        if (stderr) {
          logger.warn('Bank parser stderr:', { stderr: stderr.slice(0, 500) });
        }
        if (error) {
          reject(new Error(`Parser failed: ${error.message}`));
          return;
        }
        resolve(stdout);
      });
    });

    const parsed = JSON.parse(result);
    if (parsed.error) {
      return { success: false, error: parsed.error } as any;
    }

    logger.info(`Bank statement parsed: ${parsed.transaction_count} transactions from ${parsed.account}`);
    return parsed;

  } catch (err: any) {
    logger.error('Bank statement parser error:', err);
    return {
      success: false,
      error: err.message || 'Failed to parse statement',
    } as any;
  } finally {
    // Cleanup temp file
    try { await unlink(tmpPath); } catch { /* ignore */ }
  }
}

/**
 * Check if Python + pdfplumber are available.
 */
export async function checkParserAvailability(): Promise<{ available: boolean; error?: string }> {
  return new Promise((resolve) => {
    execFile(PYTHON_BIN, ['-c', 'import pdfplumber; print("ok")'], {
      timeout: 5000,
    }, (error, stdout) => {
      if (error || !stdout.includes('ok')) {
        resolve({ available: false, error: 'Python3 or pdfplumber not installed' });
      } else {
        resolve({ available: true });
      }
    });
  });
}
