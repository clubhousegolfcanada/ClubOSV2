-- Migration: 321_receipt_ocr_enhancements.sql
-- Description: Add OCR fields and line items support for receipts
-- Created: 2025-10-17

-- Add line_items and additional OCR fields to receipts table
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS line_items JSONB,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS export_batch TEXT,
  ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_receipts_vendor_search ON receipts USING gin(to_tsvector('english', vendor));
CREATE INDEX IF NOT EXISTS idx_receipts_amount_range ON receipts(amount_cents);
CREATE INDEX IF NOT EXISTS idx_receipts_export_batch ON receipts(export_batch) WHERE export_batch IS NOT NULL;

-- Update existing records to have proper structure
UPDATE receipts
SET ocr_confidence = CASE
    WHEN ocr_json IS NOT NULL THEN (ocr_json->>'confidence')::DECIMAL(3,2)
    ELSE NULL
  END
WHERE ocr_confidence IS NULL;

-- Add function to search receipts by any text
CREATE OR REPLACE FUNCTION search_receipts(search_text TEXT)
RETURNS TABLE(
  id UUID,
  vendor TEXT,
  amount_cents INTEGER,
  purchase_date DATE,
  category TEXT,
  confidence DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.vendor,
    r.amount_cents,
    r.purchase_date,
    r.category,
    r.ocr_confidence
  FROM receipts r
  WHERE
    r.vendor ILIKE '%' || search_text || '%' OR
    r.notes ILIKE '%' || search_text || '%' OR
    r.category ILIKE '%' || search_text || '%' OR
    r.payment_method ILIKE '%' || search_text || '%' OR
    r.ocr_text ILIKE '%' || search_text || '%' OR
    r.ocr_json::text ILIKE '%' || search_text || '%'
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN receipts.line_items IS 'Itemized list of products/services from OCR extraction';
COMMENT ON COLUMN receipts.payment_method IS 'Payment method extracted from receipt (Credit, Debit, Cash, etc)';
COMMENT ON COLUMN receipts.export_batch IS 'Batch ID for yearly exports, allows tracking what has been exported';
COMMENT ON COLUMN receipts.ocr_confidence IS 'OCR extraction confidence score (0.00 to 1.00)';