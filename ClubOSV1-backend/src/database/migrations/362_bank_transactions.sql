-- Migration: Bank transactions table for imported bank statement data
-- Stores parsed transactions from RBC chequing and Visa statements

CREATE TABLE IF NOT EXISTS bank_transactions (
  txn_id          TEXT PRIMARY KEY,
  account         TEXT NOT NULL,
  card            TEXT,
  txn_date        DATE NOT NULL,
  posting_date    DATE,
  description     TEXT NOT NULL,
  debit           INTEGER,          -- cents
  credit          INTEGER,          -- cents
  balance         INTEGER,          -- cents (chequing only)
  currency        TEXT DEFAULT 'CAD',
  fx_rate         REAL,
  cad_amount      INTEGER,          -- cents
  visa_ref        TEXT,
  source_pdf_hash TEXT,
  category        TEXT,
  matched_receipt_id UUID REFERENCES receipts(id),
  imported_at     TIMESTAMPTZ DEFAULT NOW(),
  imported_by     UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_account ON bank_transactions(account);
CREATE INDEX IF NOT EXISTS idx_bank_txn_receipt ON bank_transactions(matched_receipt_id) WHERE matched_receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_txn_hash ON bank_transactions(source_pdf_hash);
