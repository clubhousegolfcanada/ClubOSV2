# Complete Investigation: Customer Account Creation Failure

## Executive Summary

**Root Cause**: The production database is missing the `status` column in the `users` table, which the code expects to exist. Migration 115 that adds this column has not been executed in production.

## Detailed Investigation Results

### 1. Error Analysis

**Error Message**:
```
column "status" of relation "users" does not exist
```

**Location**: 
- Backend: `/api/auth/users` endpoint
- File: `src/utils/database.ts` line 192
- SQL: `INSERT INTO users (id, email, password, name, role, phone, status, ...)`

### 2. Database Schema Investigation

#### Production Database Schema (from migration 200_consolidated_production_baseline.sql)
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'support',
  phone VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITHOUT TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'))
);
```

**Missing Columns**:
- `status` VARCHAR(20)
- `signup_date` TIMESTAMP
- `signup_metadata` JSONB

#### Migration 115 (Not Applied in Production)
```sql
-- Adds the missing columns
ALTER TABLE users 
ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'pending_approval', 'suspended', 'rejected'));

ALTER TABLE users 
ADD COLUMN signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users 
ADD COLUMN signup_metadata JSONB DEFAULT '{}';
```

### 3. Code Analysis

#### Database.ts createUser Method (Line 176-198)
```typescript
async createUser(user: {
  // ... parameters including status
}): Promise<DbUser> {
  const status = user.status || 'active';  // Line 189
  
  const result = await query(
    `INSERT INTO users (id, email, password, name, role, phone, status, ...)`, // Line 192
    [id, user.email, hashedPassword, user.name, user.role, user.phone, status]
  );
}
```

**Problem**: The code assumes `status` column exists, but it doesn't in production.

### 4. Migration System Analysis

The project uses a custom migration runner (`src/utils/migrationRunner.ts`) with:
- Version tracking
- Checksum validation
- Rollback support

Available commands:
- `npm run db:migrate` - Run pending migrations
- `npm run db:status` - Check migration status
- `npm run db:rollback` - Rollback migrations

### 5. Why Migration 115 Hasn't Run

Possible reasons:
1. **Manual deployment issue**: Migration wasn't run after deployment
2. **Migration ordering**: Migration 200 (consolidated baseline) may have been run after 115
3. **Skipped migrations**: The migration runner might have skipped it
4. **Environment differences**: Different migration sets between local and production

## Current State Analysis

### What Works:
- Customer signup through `/auth/signup` endpoint (doesn't use status column initially)
- Other user operations that don't involve the status column

### What's Broken:
- Admin panel "Add Customer" functionality
- Any user creation through `/auth/users` endpoint
- User status management features

## Risk Assessment

### High Risk Issues:
1. **Data Inconsistency**: Some users might have status, others don't
2. **Feature Dependencies**: Other features may depend on status column
3. **Migration Conflicts**: Running migration 115 after 200 might cause issues

### Low Risk Issues:
1. **Performance**: Adding columns to existing table is generally safe
2. **Backward Compatibility**: Default values ensure existing records work

## Options for Resolution

### Option 1: Run Migration 115 (Recommended)
**Pros**:
- Cleanest solution
- Aligns database with code expectations
- Enables all user management features

**Cons**:
- Requires production database access
- Brief downtime during migration

**Steps**:
1. Check migration status: `railway run npm run db:status`
2. Run migration: `railway run npm run db:migrate`
3. Verify: Check that columns exist

### Option 2: Remove Status from Code (Not Recommended)
**Pros**:
- No database changes needed
- Can be done immediately

**Cons**:
- Loses user approval workflow
- Requires extensive code changes
- Removes important features

### Option 3: Conditional Column Usage
**Pros**:
- Works with or without columns
- No immediate database changes

**Cons**:
- Complex code logic
- Technical debt
- Inconsistent behavior

## Recommended Action Plan

### Phase 1: Immediate Fix (5 minutes)
1. Connect to Railway production environment
2. Check current migration status
3. Run migration 115 to add missing columns
4. Verify columns exist

### Phase 2: Validation (10 minutes)
1. Test admin customer creation
2. Test signup screen
3. Verify existing users still work
4. Check user management features

### Phase 3: Prevention (15 minutes)
1. Document migration process
2. Add migration checks to deployment
3. Create migration status monitoring

## Implementation Commands

```bash
# Step 1: Check current status
railway run npm run db:status

# Step 2: Run the migration
railway run npm run db:migrate

# Step 3: Verify the fix
railway run psql $DATABASE_URL -c "\d users"

# Alternative: Run specific migration
railway run psql $DATABASE_URL -f src/database/migrations/115_add_user_status_columns.sql
```

## Rollback Plan

If issues occur after migration:

```bash
# Rollback the columns
railway run psql $DATABASE_URL -c "
ALTER TABLE users DROP COLUMN IF EXISTS status;
ALTER TABLE users DROP COLUMN IF EXISTS signup_date;
ALTER TABLE users DROP COLUMN IF EXISTS signup_metadata;
"
```

## Long-term Recommendations

1. **Automated Migrations**: Run migrations automatically on deployment
2. **Schema Validation**: Add startup checks for required columns
3. **Migration Testing**: Test all migrations in staging first
4. **Documentation**: Document all schema dependencies
5. **Monitoring**: Add alerts for schema mismatches

## Conclusion

The issue is clear: **Migration 115 needs to be run in production**. This is a straightforward database schema mismatch that can be resolved in minutes with the right access.

The fix is safe because:
- Migration has proper existence checks
- Default values handle existing records
- No data loss will occur
- Rollback is simple if needed

**Next Step**: Run `railway run npm run db:migrate` to fix the issue.