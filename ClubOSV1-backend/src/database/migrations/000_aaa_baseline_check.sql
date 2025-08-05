-- Check if we should skip the baseline migration
-- If the users table already exists, we assume the database is already set up

DO $$
BEGIN
  -- Check if key tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    -- Database already has schema, insert a record to skip baseline
    INSERT INTO migration_history (version, name, checksum, applied_by) VALUES
      ('000', 'baseline_schema', 'skipped_existing_db', 'system')
    ON CONFLICT (version) DO NOTHING;
    
    -- Also mark this check as done
    INSERT INTO migrations (filename) VALUES ('000_baseline_check.sql')
    ON CONFLICT (filename) DO NOTHING;
    
    INSERT INTO migrations (filename) VALUES ('000_baseline_schema.sql')
    ON CONFLICT (filename) DO NOTHING;
  END IF;
END $$;