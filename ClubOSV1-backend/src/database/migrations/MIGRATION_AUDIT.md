# Database Migration Audit Report

## Summary
- **Total Migration Files**: 56+ files
- **Duplicate Table Creates**: Multiple (tickets, checklist_submissions, etc.)
- **Conflicting Migrations**: Several migrations modify same tables
- **Missing Version Control**: No migration tracking table

## Critical Issues Found

### 1. Duplicate Table Creation
- **checklist_submissions**: Created in 005 and 008
- **tickets**: Created in 000_baseline_schema.sql and 035_create_tickets_table.sql
- **ai_automation_response_tracking**: Created in 048 and 051

### 2. Multiple "Fix" Migrations
- 020_fix_missing_columns.sql
- 025_fix_openphone_column_types.sql
- 026_fix_ticket_comments_index.sql
- 029_fix_gift_card_automation.sql
- 034_fix_ticket_columns_and_indexes.sql
- 037_fix_tickets_table_column_names.sql
- 044_fix_assistant_service_timing.sql
- 045_fix_extracted_knowledge_column_sizes.sql
- 051_force_create_missing_tables.sql
- 053_fix_missing_tables.sql

### 3. Conflicting Column Modifications
- **openphone_conversations**: Modified in migrations 012, 018, 020, 023, 024, 025, 028, 041, 049
- **tickets**: Modified in migrations 026, 034, 037

### 4. Skipped/Broken Files
- 007_remote_actions.sql.skip
- 010_learning_sop_module.sql.broken

## Tables Inventory

### Core Tables (from baseline)
1. **users** - Authentication and user management
2. **tickets** - Support ticket system
3. **ticket_comments** - Comments on tickets
4. **feedback** - User feedback on AI responses
5. **slack_replies** - Slack integration data
6. **checklist_submissions** - Daily checklist tracking
7. **checklist_task_customizations** - Custom checklist tasks
8. **openphone_conversations** - SMS conversations
9. **remote_action_history** - NinjaOne action logs
10. **system_config** - System configuration
11. **knowledge_base** - Knowledge articles
12. **assistant_knowledge** - AI assistant data
13. **public_requests** - Public API requests
14. **push_subscriptions** - Push notification subscriptions
15. **notification_history** - Notification logs
16. **notification_preferences** - User notification settings
17. **ai_prompt_templates** - Prompt templates
18. **ai_automation_features** - Automation configuration
19. **ai_automation_usage** - Usage tracking
20. **ai_automation_response_tracking** - Response tracking
21. **extracted_knowledge** - AI-extracted knowledge
22. **hubspot_contact_cache** - HubSpot integration cache
23. **door_access_log** - UniFi door access logs
24. **knowledge_store** - New knowledge storage system

## Migration Dependencies

### Order Dependencies
1. users → tickets (user_id foreign key)
2. tickets → ticket_comments (ticket_id foreign key)
3. openphone_conversations → extracted_knowledge (conversation_id)
4. ai_automation_features → ai_automation_usage (feature_key)

## Recommended Actions

### Phase 1: Immediate Fixes
1. Create migration tracking table
2. Consolidate all migrations into baseline
3. Remove duplicate CREATE TABLE statements
4. Fix column naming inconsistencies

### Phase 2: New Migration System
1. Implement version control
2. Add rollback support
3. Create migration validator
4. Add dependency management

## Migration Consolidation Plan

### Step 1: Create New Baseline (000_consolidated_baseline.sql)
Combine all successful migrations into single file with:
- Proper table creation order
- All indexes
- All constraints
- Initial data

### Step 2: Create Migration Tracker
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64),
  success BOOLEAN DEFAULT true,
  rollback_sql TEXT
);
```

### Step 3: Implement Rollback Support
Each migration should include:
- Forward migration (UP)
- Rollback migration (DOWN)
- Validation queries

### Step 4: Test Migration Path
1. Backup current database
2. Drop all tables (in dev)
3. Run consolidated baseline
4. Verify all functionality
5. Document any data migrations needed

## Risk Assessment

### High Risk
- Data loss if migrations not properly tested
- Production downtime during migration
- Foreign key constraint violations

### Mitigation
- Extensive testing in staging environment
- Complete database backup before migration
- Rollback plan for each step
- Parallel run of old and new schemas if needed

## Next Steps
1. ✅ Audit complete
2. Create consolidated baseline migration
3. Test in development environment
4. Create rollback procedures
5. Document migration process
6. Execute in staging
7. Deploy to production