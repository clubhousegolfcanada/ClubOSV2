# Ticket Creation 500 Error Investigation Report

**Date**: September 22, 2025
**Issue**: POST https://clubosv2-production.up.railway.app/api/tickets returns 500 Internal Server Error

## Executive Summary

Tickets cannot be created because the database is missing the `photo_urls` column that the application code expects. This is a database migration issue where migration #222 was not applied to production.

## Root Cause Analysis

### The Problem Flow:

1. **Frontend sends ticket with photo_urls** (array of photo attachments)
2. **Backend receives and validates** the request correctly
3. **Database INSERT fails** because `photo_urls` column doesn't exist
4. **500 error returned** to frontend

### Evidence Found:

#### 1. SQL Query Mismatch (database.ts)
```typescript
// Line from createTicket method
`INSERT INTO tickets (
  id, title, description, category, status, priority, location,
  created_by_id, created_by_name, created_by_email, created_by_phone,
  assigned_to_id, assigned_to_name, assigned_to_email, metadata, photo_urls
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`
```
- Inserts into 16 columns including `photo_urls`
- Provides 16 values ($1 through $16)

#### 2. Original Table Schema (database-tables.ts)
```sql
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  created_by_id UUID NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_phone VARCHAR(50),
  assigned_to_id UUID,
  assigned_to_name VARCHAR(255),
  assigned_to_email VARCHAR(255),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);
```
- **NO photo_urls column** in base schema

#### 3. Migration Exists But Not Applied
File: `src/database/migrations/222_add_ticket_photos.sql`
```sql
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
```
- Migration #222 adds the missing column
- This migration was NOT run in production

### Database Pool Issues Observed
From the logs:
```
Pool growing: 7 active, 0 idle, 3 waiting (7/20 total)
Database pool status: total:10, idle:3, waiting:0, activeQueries:8
```
- High database pool usage indicates many failed queries
- Queries are likely failing and retrying

## Why The Migration Wasn't Applied

1. **No Automatic Migration Runner**: The application doesn't automatically run SQL migrations from the `/database/migrations` folder on startup

2. **Manual Migrations Only**: Current system only runs hardcoded migrations in `database-migrations.ts`, not the SQL files

3. **Missing Integration**: The migration system exists but isn't integrated into the deployment pipeline

## Impact

- **All ticket creation fails** with 500 error
- **Photo attachment feature unavailable** for tickets
- **User frustration** as tickets cannot be created
- **Database pool exhaustion** from failed queries

## Solution

### Immediate Fix (Production)
Run the migration manually to add the missing column:

```bash
./scripts/run-ticket-photo-migration.sh
```

Or directly in production:
```sql
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tickets_has_photos
ON tickets ((array_length(photo_urls, 1) > 0));
```

### Long-term Fix
1. **Integrate migration runner** into application startup
2. **Add migration command** to deployment pipeline
3. **Create migration status check** endpoint
4. **Document migration process** for team

## Verification Steps

After applying the fix:
1. Check column exists:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tickets'
AND column_name = 'photo_urls';
```

2. Test ticket creation through UI
3. Verify photos can be attached
4. Monitor error logs for resolution

## Prevention

1. **Automated Migrations**: Add migration runner to startup sequence
2. **Migration Testing**: Test all migrations in staging before production
3. **Schema Validation**: Add startup check for required columns
4. **CI/CD Integration**: Run migrations as part of deployment
5. **Monitoring**: Alert on 500 errors with database details

## Related Files

- `/src/utils/database.ts` - createTicket method
- `/src/utils/database-tables.ts` - Base table schema
- `/src/database/migrations/222_add_ticket_photos.sql` - Missing migration
- `/src/routes/tickets.ts` - API endpoint
- `/scripts/run-ticket-photo-migration.sh` - Fix script

## Conclusion

This is a classic database migration issue where application code was updated to support photo attachments but the corresponding database migration wasn't applied in production. The fix is straightforward - run the migration to add the `photo_urls` column.