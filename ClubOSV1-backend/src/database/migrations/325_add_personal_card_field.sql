-- Migration: 325_add_personal_card_field.sql
-- Description: Add personal card field to receipts table for tracking personal purchases needing reimbursement
-- Created: 2025-10-20

-- Add is_personal_card column to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS is_personal_card BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN receipts.is_personal_card IS 'Indicates if the purchase was made with a personal card (requiring reimbursement) rather than a Clubhouse card';

-- Add index for filtering personal card purchases
CREATE INDEX IF NOT EXISTS idx_receipts_personal_card
ON receipts(is_personal_card)
WHERE is_personal_card = TRUE;

-- Add to audit log for tracking changes
ALTER TABLE receipt_audit_log
ADD COLUMN IF NOT EXISTS is_personal_card_changed BOOLEAN DEFAULT FALSE;