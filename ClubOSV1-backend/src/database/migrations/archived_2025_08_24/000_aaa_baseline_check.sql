-- Check if we should skip the baseline migration
-- If the users table already exists, we assume the database is already set up

-- Create migration tables if they don't exist
CREATE TABLE IF NOT EXISTS migration_history (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  applied_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If users table exists, mark baseline as complete
INSERT INTO migration_history (version, name, checksum, applied_by)
SELECT '000', 'baseline_schema', 'skipped_existing_db', 'system'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
ON CONFLICT (version) DO NOTHING;

-- Mark this check as done
INSERT INTO migrations (filename) 
SELECT '000_aaa_baseline_check.sql'
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE filename = '000_aaa_baseline_check.sql');

-- If users table exists, also mark baseline schema as done
INSERT INTO migrations (filename) 
SELECT '000_baseline_schema.sql'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
  AND NOT EXISTS (SELECT 1 FROM migrations WHERE filename = '000_baseline_schema.sql');