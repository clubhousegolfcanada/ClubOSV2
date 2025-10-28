# ClubOS Migration System Guide

## Overview

ClubOS now has a professional, enterprise-grade migration system that automatically runs on every deployment. This guide explains how it works and how to use it.

## Quick Start

### Running Migrations

```bash
# Check migration status
npm run db:status

# Run all pending migrations
npm run db:migrate

# Test migrations without applying (dry-run)
npm run db:migrate:dry

# Rollback last migration
npm run db:rollback

# Rollback last 3 migrations
npm run db:rollback 3
```

## How It Works

### Automatic Execution
1. **On Every Deploy**: When you push to main, Railway auto-deploys
2. **Server Startup**: The backend runs migrations automatically during startup
3. **Lock Protection**: Migration locks prevent concurrent execution
4. **Version Tracking**: The `schema_migrations` table tracks what's been run

### Migration Flow
```
Git Push → Railway Deploy → Server Start → Initialize DB → Run Migrations → Start API
```

## Migration System Features

### 1. Version Tracking
- Every migration has a version number (e.g., `338_comprehensive_booking_fix.sql`)
- The `schema_migrations` table tracks:
  - Which migrations have run
  - When they were executed
  - Checksums to detect modifications
  - Execution time
  - Success/failure status

### 2. Concurrency Protection
- `migration_locks` table prevents multiple servers from running migrations simultaneously
- 30-second timeout for stale locks
- Automatic lock cleanup

### 3. Rollback Support
- Migrations can include `-- DOWN` sections for rollback
- Example:
```sql
-- UP
CREATE TABLE example (id SERIAL PRIMARY KEY);

-- DOWN
DROP TABLE IF EXISTS example;
```

### 4. Transaction Safety
- Each migration runs in a transaction
- All-or-nothing execution
- Automatic rollback on error

### 5. Dry-Run Mode
- Test migrations without applying them
- See what would change
- Validate SQL syntax

## Creating New Migrations

### File Naming Convention
```
[number]_[description].sql
```
Examples:
- `339_add_user_preferences.sql`
- `340_fix_booking_constraints.sql`

### Migration Template
```sql
-- Migration: [number]_[description].sql
-- Purpose: [What this migration does]
-- Author: [Your name]
-- Date: [YYYY-MM-DD]

-- UP
BEGIN;

-- Your migration SQL here
CREATE TABLE IF NOT EXISTS example (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

-- DOWN
BEGIN;

DROP TABLE IF EXISTS example;

COMMIT;
```

### Best Practices

1. **Always Use IF EXISTS/IF NOT EXISTS**
   - Makes migrations idempotent (safe to run multiple times)
   - Example: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE IF EXISTS`

2. **Handle Schema Evolution**
   ```sql
   -- Check if old column exists and migrate
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='bookings' AND column_name='old_column') THEN
       ALTER TABLE bookings RENAME COLUMN old_column TO new_column;
     END IF;
   END $$;
   ```

3. **Include Indexes**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
   ```

4. **Add Constraints Carefully**
   ```sql
   -- Check if constraint exists before adding
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'my_constraint') THEN
       ALTER TABLE my_table ADD CONSTRAINT my_constraint CHECK (column > 0);
     END IF;
   END $$;
   ```

## The Booking System Fix

### Problem
- Booking system migrations (015, 235, 238, 317, 319, 336) existed but never ran
- The SQL migration runner was commented out
- Only inline migrations were running

### Solution Applied
1. **Enabled Migration Runner**: Uncommented and configured in `database.ts`
2. **Added Lock Support**: Prevents concurrent migrations
3. **Created Comprehensive Fix**: Migration 338 handles any starting state
4. **Now Auto-Runs**: Migrations execute on every deploy

### Migration 338 Features
- Creates booking tables if missing
- Migrates old column names (simulator_id → space_ids, start_time → start_at)
- Adds all 6 locations with correct box counts
- Creates customer tiers with pricing
- Adds indexes for performance
- Prevents double bookings with constraints

## Troubleshooting

### Common Issues

1. **Migration Lock Stuck**
   ```sql
   -- Manually clear lock if stuck
   DELETE FROM migration_locks WHERE id = 1;
   ```

2. **Migration Failed**
   - Check logs: `railway logs`
   - View error: `SELECT * FROM schema_migrations WHERE success = false;`
   - Fix issue and re-run

3. **Need to Skip a Migration**
   - Rename file to include `.skip`: `338_migration.sql.skip`
   - Or manually mark as executed:
   ```sql
   INSERT INTO schema_migrations (version, name, checksum, executed_at)
   VALUES ('338', '338_comprehensive_booking_fix', 'checksum', NOW());
   ```

### Checking Production Status

```bash
# Connect to production database
railway run psql $DATABASE_URL

# Check migration status
SELECT version, name, executed_at, success
FROM schema_migrations
ORDER BY version DESC
LIMIT 10;

# Check if booking tables exist
\dt booking*
```

## Migration Commands Reference

| Command | Description |
|---------|-------------|
| `npm run db:status` | Show pending and applied migrations |
| `npm run db:migrate` | Run all pending migrations |
| `npm run db:migrate:dry` | Preview migrations without applying |
| `npm run db:rollback` | Rollback last migration |
| `npm run db:rollback N` | Rollback last N migrations |
| `npm run db:validate` | Check migration checksums |

## Important Files

- `/src/utils/migrationRunner.ts` - Main migration runner
- `/src/utils/database.ts` - Database initialization (calls migrationRunner)
- `/src/database/migrations/` - Migration SQL files
- `/MIGRATION_GUIDE.md` - This documentation

## Safety Features

1. **Checksum Validation**: Detects if migrations were modified after running
2. **Dry-Run Mode**: Test before applying
3. **Transaction Wrapping**: Automatic rollback on error
4. **Lock Timeout**: Prevents indefinite locks
5. **Idempotent Design**: Safe to run multiple times

## Next Steps

After deploying this fix:

1. **Monitor First Deploy**: Watch logs during deployment
2. **Verify Tables**: Check that booking tables were created
3. **Remove Defensive Code**: Clean up workarounds in `routes/bookings.ts`
4. **Test Booking System**: Verify bookings work end-to-end

## Future Migrations

When adding new features:

1. Create migration file: `339_your_feature.sql`
2. Test locally: `npm run db:migrate:dry`
3. Commit and push - auto-deploys and runs
4. Monitor logs to ensure success

## Summary

The migration system is now:
- ✅ Enabled and running automatically
- ✅ Protected against concurrent execution
- ✅ Tracking all migrations with checksums
- ✅ Supporting rollbacks
- ✅ Ready for production use

The booking system will be fixed on the next deployment when migration 338 runs automatically.