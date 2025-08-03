# Database Migration Audit

## Overview
Total migration files: 29
Major issues identified: Multiple duplicate table definitions, conflicting schemas, no versioning system

## Critical Issues

### 1. Duplicate Table Definitions

#### checklist_submissions
- **005_checklist_submissions.sql** - First definition
- **008_checklist_submissions.sql** - Duplicate definition (3 days later)
- **Conflict**: Same table created twice, potential data loss

#### tickets table
- **002_create_tickets_table.sql** - Original definition
- **021_fix_tickets_table_column_names.sql** - Column fixes
- **026_fix_ticket_comments_index.sql** - Index fixes
- **027_fix_ticket_columns_and_indexes.sql** - More fixes
- **Issue**: Multiple patches instead of clean migration

#### openphone_conversations
- **011_openphone_sop_system.sql** - First definition
- **012_add_openphone_missing_columns.sql** - Missing columns
- **017_openphone_messages_enhancement.sql** - Enhancements
- **018_add_updated_at_to_openphone.sql** - More missing columns
- **020_fix_missing_columns.sql** - More fixes
- **023_ensure_openphone_columns.sql** - Ensuring columns exist
- **024_add_updated_at_column.sql** - Another updated_at attempt
- **025_fix_openphone_column_types.sql** - Type fixes
- **Issue**: 8 files to define one table!

### 2. Naming Inconsistencies
- Some files use descriptive names (e.g., `create_tickets_table.sql`)
- Others use generic names (e.g., `fix_missing_columns.sql`)
- No clear versioning pattern

### 3. Missing Core Tables
No migration files found for:
- users table
- system_config table
- Other core tables defined in index.ts

### 4. Order Dependencies
Current numeric prefixes don't reflect actual dependencies:
- 021 appears twice (ai_prompt_templates.sql and fix_tickets_table_column_names.sql)
- add-document-relationships.sql has no number

## Tables Created by Migrations

1. **feedback** - 001, 002, 003
2. **slack_messages** - 001
3. **slack_replies** - 004
4. **checklist_submissions** - 005, 008 (duplicate!)
5. **remote_actions_log** - 007
6. **knowledge_captures** - 010
7. **sop_update_queue** - 010
8. **sop_drafts** - 010
9. **sop_update_log** - 010
10. **slack_thread_resolutions** - 010
11. **learning_metrics** - 010
12. **openphone_conversations** - 011 (plus 7 fix files)
13. **extracted_knowledge** - 011
14. **sop_shadow_comparisons** - 011
15. **sop_metrics** - 011
16. **vector_store_archive** - 013
17. **vector_store_deletion_log** - 013
18. **knowledge_audit_log** - 013
19. **assistant_knowledge** - 014
20. **public_requests** - 015
21. **checklist_task_customizations** - 016
22. **message_status** - 017
23. **push_subscriptions** - 019
24. **notification_history** - 019
25. **notification_preferences** - 019
26. **ai_prompt_templates** - 021
27. **ai_prompt_template_history** - 021
28. **tickets** - 002 (plus 4 fix files)
29. **ticket_comments** - 002
30. **parent_documents** - add-document-relationships
31. **hubspot_cache** - 028

## Recommended Consolidation Strategy

### Phase 1: Core Tables (no dependencies)
- users
- system_config
- feedback
- public_requests

### Phase 2: Feature Tables (depend on users)
- tickets & ticket_comments
- checklist_submissions & checklist_task_customizations
- remote_actions_log
- push_subscriptions, notification_history, notification_preferences

### Phase 3: Integration Tables
- openphone_conversations & message_status
- slack_messages & slack_replies & slack_thread_resolutions
- hubspot_cache

### Phase 4: AI/Knowledge Tables
- assistant_knowledge
- knowledge_captures & knowledge_audit_log
- ai_prompt_templates & ai_prompt_template_history
- parent_documents

### Phase 5: Legacy/Archive Tables
- sop_* tables (being phased out)
- vector_store_* tables (archived)
- learning_metrics

## Action Items
1. Create 000_baseline_schema.sql consolidating all tables
2. Remove all duplicate CREATE TABLE statements
3. Implement proper migration versioning
4. Add rollback support
5. Create data migration scripts for existing deployments