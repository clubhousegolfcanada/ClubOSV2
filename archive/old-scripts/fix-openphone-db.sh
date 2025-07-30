#!/bin/bash
# Fix database schema issue for openphone_conversations

echo "🔧 Fixing OpenPhone database schema..."

# Create SQL migration file
cat > /tmp/fix_openphone_schema.sql << 'EOF'
-- Fix openphone_conversations table schema
-- The table exists but is missing the conversation_id column

-- Check if column exists first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'openphone_conversations' 
        AND column_name = 'conversation_id'
    ) THEN
        -- Add the missing column
        ALTER TABLE openphone_conversations 
        ADD COLUMN conversation_id VARCHAR(255) UNIQUE;
        
        -- Update existing rows to have a conversation_id based on their id
        UPDATE openphone_conversations 
        SET conversation_id = 'conv_' || id::text 
        WHERE conversation_id IS NULL;
        
        RAISE NOTICE 'Added conversation_id column to openphone_conversations table';
    ELSE
        RAISE NOTICE 'conversation_id column already exists';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
ORDER BY ordinal_position;
EOF

echo "✅ Created migration script: /tmp/fix_openphone_schema.sql"
echo ""
echo "To apply this fix, run:"
echo "psql \$DATABASE_URL -f /tmp/fix_openphone_schema.sql"
echo ""
echo "Or if using Railway:"
echo "railway run psql \$DATABASE_URL -f /tmp/fix_openphone_schema.sql"
