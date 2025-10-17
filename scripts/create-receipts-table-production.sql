-- Quick production fix for missing receipts table
-- Run this in your production database to enable receipt OCR storage

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor TEXT,
    amount_cents INTEGER,
    tax_cents INTEGER,
    subtotal_cents INTEGER,
    purchase_date DATE,
    club_location TEXT,
    category TEXT,
    payment_method TEXT,
    notes TEXT,
    file_data TEXT, -- Base64 encoded image
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    uploader_user_id UUID REFERENCES users(id),
    ocr_status TEXT DEFAULT 'pending',
    ocr_text TEXT,
    ocr_json JSONB,
    ocr_confidence DECIMAL(3,2),
    line_items JSONB,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP,
    reconciled_by UUID REFERENCES users(id),
    export_batch TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_vendor ON receipts(vendor);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_uploader ON receipts(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_reconciled ON receipts(reconciled);

-- Create audit log table
CREATE TABLE IF NOT EXISTS receipt_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changed_fields JSONB,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE receipts IS 'Stores uploaded receipts with OCR-extracted data';