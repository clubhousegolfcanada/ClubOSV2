-- Add HST-specific fields for Canadian tax accounting
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS hst_cents INTEGER;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS hst_reg_number TEXT;
