-- Migration: Standardize ticket location values to proper capitalization with spaces
-- Date: 2025-10-28
-- Purpose: Fix inconsistent location values in tickets table

-- Update all location values to standardized format
-- Convert lowercase to proper capitalization
UPDATE tickets
SET location = 'Bedford'
WHERE LOWER(location) = 'bedford';

UPDATE tickets
SET location = 'Dartmouth'
WHERE LOWER(location) = 'dartmouth';

UPDATE tickets
SET location = 'Halifax'
WHERE LOWER(location) = 'halifax';

UPDATE tickets
SET location = 'Stratford'
WHERE LOWER(location) = 'stratford';

UPDATE tickets
SET location = 'Truro'
WHERE LOWER(location) = 'truro';

-- Convert hyphenated to space-separated for multi-word locations
UPDATE tickets
SET location = 'Bayers Lake'
WHERE LOWER(location) IN ('bayers-lake', 'bayers lake', 'bayerslake');

UPDATE tickets
SET location = 'River Oaks'
WHERE LOWER(location) IN ('river-oaks', 'river oaks', 'riveroaks');

-- Log the migration completion
DO $$
DECLARE
    total_updated INTEGER;
    bedford_count INTEGER;
    dartmouth_count INTEGER;
    halifax_count INTEGER;
    bayers_lake_count INTEGER;
    river_oaks_count INTEGER;
    stratford_count INTEGER;
    truro_count INTEGER;
BEGIN
    -- Count tickets by location for logging
    SELECT COUNT(*) INTO bedford_count FROM tickets WHERE location = 'Bedford';
    SELECT COUNT(*) INTO dartmouth_count FROM tickets WHERE location = 'Dartmouth';
    SELECT COUNT(*) INTO halifax_count FROM tickets WHERE location = 'Halifax';
    SELECT COUNT(*) INTO bayers_lake_count FROM tickets WHERE location = 'Bayers Lake';
    SELECT COUNT(*) INTO river_oaks_count FROM tickets WHERE location = 'River Oaks';
    SELECT COUNT(*) INTO stratford_count FROM tickets WHERE location = 'Stratford';
    SELECT COUNT(*) INTO truro_count FROM tickets WHERE location = 'Truro';

    total_updated := bedford_count + dartmouth_count + halifax_count +
                     bayers_lake_count + river_oaks_count + stratford_count + truro_count;

    RAISE NOTICE 'Ticket location standardization complete:';
    RAISE NOTICE '  Bedford: % tickets', bedford_count;
    RAISE NOTICE '  Dartmouth: % tickets', dartmouth_count;
    RAISE NOTICE '  Halifax: % tickets', halifax_count;
    RAISE NOTICE '  Bayers Lake: % tickets', bayers_lake_count;
    RAISE NOTICE '  River Oaks: % tickets', river_oaks_count;
    RAISE NOTICE '  Stratford: % tickets', stratford_count;
    RAISE NOTICE '  Truro: % tickets', truro_count;
    RAISE NOTICE '  Total standardized: % tickets', total_updated;
END$$;

-- Create an index on location for better query performance
CREATE INDEX IF NOT EXISTS idx_tickets_location_lower ON tickets(LOWER(location));

-- Add a comment to the tickets table about location standardization
COMMENT ON COLUMN tickets.location IS 'Standardized location values: Bedford, Dartmouth, Halifax, Bayers Lake, River Oaks, Stratford, Truro';