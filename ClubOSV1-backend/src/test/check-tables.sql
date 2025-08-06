-- Check if critical tables and columns exist

-- Check tables
SELECT 'ai_automation_response_tracking table' as check_name,
       EXISTS (SELECT FROM pg_tables WHERE tablename = 'ai_automation_response_tracking') as exists;

SELECT 'openphone_conversations table' as check_name,
       EXISTS (SELECT FROM pg_tables WHERE tablename = 'openphone_conversations') as exists;

-- Check columns in openphone_conversations
SELECT 'openphone_conversations.assistant_type column' as check_name,
       EXISTS (
         SELECT FROM information_schema.columns 
         WHERE table_name = 'openphone_conversations' 
         AND column_name = 'assistant_type'
       ) as exists;

SELECT 'openphone_conversations.last_assistant_type column' as check_name,
       EXISTS (
         SELECT FROM information_schema.columns 
         WHERE table_name = 'openphone_conversations' 
         AND column_name = 'last_assistant_type'
       ) as exists;

-- Check migrations
SELECT 'Migration 048' as check_name, 
       EXISTS (SELECT FROM migrations WHERE filename = '048_create_response_tracking_table.sql') as exists;
       
SELECT 'Migration 049' as check_name,
       EXISTS (SELECT FROM migrations WHERE filename = '049_add_assistant_type_columns.sql') as exists;

-- Show last 5 migrations
SELECT 'Last 5 migrations:' as info;
SELECT filename, executed_at FROM migrations ORDER BY id DESC LIMIT 5;