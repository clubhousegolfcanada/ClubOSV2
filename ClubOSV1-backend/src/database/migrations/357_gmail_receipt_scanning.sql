-- Gmail message tracking for idempotent receipt scanning
CREATE TABLE IF NOT EXISTS gmail_scanned_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT UNIQUE NOT NULL,
  thread_id       TEXT,
  from_address    TEXT,
  subject         TEXT,
  email_date      TIMESTAMPTZ,
  attachment_count INTEGER DEFAULT 0,
  receipts_created INTEGER DEFAULT 0,
  skipped_reason  TEXT,
  processed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_scanned_date ON gmail_scanned_messages(email_date);
CREATE INDEX IF NOT EXISTS idx_gmail_scanned_msg_id ON gmail_scanned_messages(message_id);

-- Add source tracking to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'terminal';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source_email TEXT;

CREATE INDEX IF NOT EXISTS idx_receipts_source ON receipts(source);
CREATE INDEX IF NOT EXISTS idx_receipts_gmail_msg ON receipts(gmail_message_id);
