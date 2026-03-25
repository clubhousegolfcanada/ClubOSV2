-- Migration: 363_backfill_receipt_tax_from_ocr_json.sql
-- Description: Backfill hst_cents and tax_cents from ocr_json where columns are NULL
-- In Nova Scotia, a single "Tax" line on a receipt IS HST (15%)
-- Created: 2026-03-25

-- Step 1: Backfill tax_cents from ocr_json->>'taxAmount' (stored in dollars, convert to cents)
UPDATE receipts
SET tax_cents = ROUND((ocr_json->>'taxAmount')::numeric * 100)
WHERE tax_cents IS NULL
  AND ocr_json IS NOT NULL
  AND ocr_json->>'taxAmount' IS NOT NULL
  AND (ocr_json->>'taxAmount')::numeric > 0;

-- Step 2: Backfill hst_cents from ocr_json->>'hstAmount' (stored in dollars, convert to cents)
UPDATE receipts
SET hst_cents = ROUND((ocr_json->>'hstAmount')::numeric * 100)
WHERE hst_cents IS NULL
  AND ocr_json IS NOT NULL
  AND ocr_json->>'hstAmount' IS NOT NULL
  AND (ocr_json->>'hstAmount')::numeric > 0;

-- Step 3: For receipts where hst_cents is still NULL but tax_cents exists,
-- copy tax_cents to hst_cents (NS rule: single "Tax" line = HST)
UPDATE receipts
SET hst_cents = tax_cents
WHERE hst_cents IS NULL
  AND tax_cents IS NOT NULL
  AND tax_cents > 0;
