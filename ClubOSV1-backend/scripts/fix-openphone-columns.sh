#!/bin/bash
# Fix OpenPhone missing columns for Pattern Learning System

echo "====================================="
echo "Fixing OpenPhone Missing Columns"
echo "====================================="

# Run the migration via Railway
echo "Running migration 230..."
railway run --service clubosv2 psql $DATABASE_URL << 'EOF'
-- Add missing operator tracking columns to openphone_conversations
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS operator_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS operator_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS rapid_message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_response_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_openphone_operator_active
ON openphone_conversations(operator_active)
WHERE operator_active = true;

CREATE INDEX IF NOT EXISTS idx_openphone_lockout
ON openphone_conversations(lockout_until)
WHERE lockout_until > NOW();

-- Verify columns were added
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
AND column_name IN (
  'operator_active',
  'operator_last_message',
  'conversation_locked',
  'lockout_until',
  'rapid_message_count',
  'ai_response_count'
);

SELECT 'Migration complete! Missing columns have been added.' as status;
EOF

echo ""
echo "Testing webhook after fix..."
curl -X POST "https://clubosv2-production.up.railway.app/api/openphone/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "data": {
      "id": "test_after_fix_'$(date +%s)'",
      "from": "+19022929623",
      "to": ["+19027073748"],
      "body": "Test message after column fix",
      "direction": "incoming",
      "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "contactName": "Test User"
    }
  }'

echo ""
echo "====================================="
echo "Fix complete! Messages should now work."
echo "====================================="