-- Migration 028: Simple HubSpot cache table
-- Purpose: Cache HubSpot contact lookups to reduce API calls

-- Create simple cache table for HubSpot lookups
CREATE TABLE IF NOT EXISTS hubspot_cache (
  phone_number VARCHAR(20) PRIMARY KEY,
  customer_name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  hubspot_contact_id VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_hubspot_cache_updated ON hubspot_cache(updated_at);

-- Create function to automatically update timestamp
CREATE OR REPLACE FUNCTION update_hubspot_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update timestamp on updates
DROP TRIGGER IF EXISTS update_hubspot_cache_timestamp_trigger ON hubspot_cache;
CREATE TRIGGER update_hubspot_cache_timestamp_trigger
BEFORE UPDATE ON hubspot_cache
FOR EACH ROW
EXECUTE FUNCTION update_hubspot_cache_timestamp();

-- Add comment for documentation
COMMENT ON TABLE hubspot_cache IS 'Simple cache for HubSpot contact lookups to reduce API calls. Entries older than 24 hours should be considered stale.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 028_simple_hubspot_cache completed successfully';
END $$;