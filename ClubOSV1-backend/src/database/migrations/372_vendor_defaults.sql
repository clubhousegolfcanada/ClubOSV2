-- Vendor defaults: learned from user corrections
-- When a user edits a receipt's category or location, we remember
-- that vendor's defaults for future auto-categorization.
CREATE TABLE IF NOT EXISTS vendor_defaults (
  vendor_normalized TEXT PRIMARY KEY,
  category TEXT,
  club_location TEXT,
  payment_method TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_defaults_updated ON vendor_defaults (updated_at DESC);
