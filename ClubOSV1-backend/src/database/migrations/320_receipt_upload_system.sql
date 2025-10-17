-- Migration: 320_receipt_upload_system.sql
-- Description: Add receipt upload and tracking system
-- Created: 2025-10-17

-- Main receipts table (simplified to use existing patterns)
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File storage (using base64 like tickets/checklists)
  file_data TEXT, -- Base64 encoded file content
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Receipt metadata
  vendor TEXT,
  amount_cents INTEGER,
  tax_cents INTEGER,
  purchase_date DATE,
  club_location TEXT,
  category TEXT,
  payment_method TEXT,

  -- OCR results (simplified - no external services initially)
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'manual')),
  ocr_text TEXT,
  ocr_json JSONB,

  -- Tracking
  uploader_user_id UUID REFERENCES users(id),
  notes TEXT,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_vendor ON receipts(vendor);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(purchase_date);
CREATE INDEX IF NOT EXISTS idx_receipts_location ON receipts(club_location);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(ocr_status) WHERE ocr_status != 'completed';
CREATE INDEX IF NOT EXISTS idx_receipts_uploader ON receipts(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_reconciled ON receipts(reconciled) WHERE reconciled = false;

-- Simple audit log for tracking changes
CREATE TABLE IF NOT EXISTS receipt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_fields JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS receipts_updated_at ON receipts;
CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipts_updated_at();