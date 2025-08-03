# Migration Cleanup Plan

## Overview
After successfully applying the baseline migration (000_baseline_schema.sql), the following migration files should be removed as they have been consolidated.

## Files to Remove (29 files)

### Remove these migration files:
```bash
# Feedback/Slack related
rm 001_add_slack_reply_tracking.sql
rm 002_create_feedback_table.sql
rm 003_add_feedback_columns.sql
rm 004_add_slack_replies_table.sql

# Tickets related (multiple fixes for same table)
rm 002_create_tickets_table.sql
rm 021_fix_tickets_table_column_names.sql
rm 026_fix_ticket_comments_index.sql
rm 027_fix_ticket_columns_and_indexes.sql

# Checklist related (duplicate definitions)
rm 005_checklist_submissions.sql
rm 008_checklist_submissions.sql
rm 016_checklist_task_customizations.sql

# OpenPhone related (8 files for one table!)
rm 011_openphone_sop_system.sql
rm 012_add_openphone_missing_columns.sql
rm 017_openphone_messages_enhancement.sql
rm 018_add_updated_at_to_openphone.sql
rm 020_fix_missing_columns.sql
rm 023_ensure_openphone_columns.sql
rm 024_add_updated_at_column.sql
rm 025_fix_openphone_column_types.sql

# Other feature tables
rm 007_remote_actions.sql
rm 010_learning_sop_module.sql
rm 013_disable_sop_system.sql
rm 014_create_assistant_knowledge_table.sql
rm 015_create_public_requests_table.sql
rm 019_push_notifications.sql
rm 021_ai_prompt_templates.sql
rm 028_simple_hubspot_cache.sql

# Misc
rm 002_performance_indexes.sql
rm add-document-relationships.sql
```

## Files to Keep

### Keep these files:
- `000_baseline_schema.sql` - The new consolidated baseline
- `MIGRATION_AUDIT.md` - Documentation of the consolidation
- `MIGRATION_CLEANUP_PLAN.md` - This file

## Cleanup Script

Run this script to remove old migrations:

```bash
#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/src/database/migrations

# Create backup directory
mkdir -p archived_migrations
mv *.sql archived_migrations/ 2>/dev/null || true

# Keep only the baseline
mv archived_migrations/000_baseline_schema.sql . 2>/dev/null || true

echo "Old migrations archived to archived_migrations/"
echo "Only 000_baseline_schema.sql remains active"
```

## Verification Steps

After cleanup:
1. Run `npm run migrate:status` to verify only baseline is tracked
2. Test application functionality
3. Ensure no errors in logs
4. Commit the changes

## Rollback Plan

If issues arise:
1. Restore files from `archived_migrations/`
2. Or restore from git: `git checkout -- .`

## Next Steps

1. Update deployment scripts to use new migration system
2. Document the new migration workflow
3. Train team on new migration commands:
   - `npm run migrate:create <name>` - Create new migration
   - `npm run migrate:up` - Apply pending migrations
   - `npm run migrate:down` - Rollback last migration
   - `npm run migrate:status` - Check migration status