# V3-PLS Automatic Pattern Learning from OpenPhone

## Overview
The V3-PLS system is designed to automatically learn patterns from real operator responses to customer messages via OpenPhone. However, it needs to be properly enabled to work.

## How Automatic Pattern Learning Works

### 1. **Message Flow**
```
Customer sends SMS → OpenPhone → Webhook → ClubOS Backend
                                              ↓
                                    Pattern Learning Service
                                              ↓
                                    Check for existing pattern
                                              ↓
                         No pattern found → Escalate to operator
                                              ↓
                                    Operator responds via OpenPhone
                                              ↓
                                    LEARNING OPPORTUNITY!
                                              ↓
                                    New pattern created automatically
```

### 2. **When Patterns Are Created**

The system learns a new pattern when:
1. **Customer sends a message** that doesn't match any existing pattern
2. **Operator responds** via OpenPhone (not an automated response)
3. **System detects** the operator's response as human-written (no [Automated] tags)
4. **Pattern learning is ENABLED** in the configuration

### 3. **Current Status: LIKELY DISABLED**

Based on the code, pattern learning is **disabled by default** and needs to be explicitly enabled.

## Why New Patterns Aren't Being Created

### Possible Reasons:
1. **Pattern learning is disabled** (most likely)
2. **System is in shadow mode** (logs but doesn't create patterns)
3. **Confidence thresholds are too high**
4. **OpenPhone webhook isn't properly configured**
5. **Operator responses are being tagged as automated**

## How to Enable Automatic Pattern Learning

### Option 1: Via Database (Recommended)

Run this SQL script to enable pattern learning:

```sql
-- Enable pattern learning system
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';

-- Set reasonable thresholds
UPDATE pattern_learning_config SET config_value = '0.60' WHERE config_key = 'min_confidence_to_suggest';
UPDATE pattern_learning_config SET config_value = '0.85' WHERE config_key = 'min_confidence_to_act';
UPDATE pattern_learning_config SET config_value = '1' WHERE config_key = 'min_occurrences_to_learn';

-- Check current status
SELECT config_key, config_value 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode');
```

### Option 2: Use the Pre-Built Script

```bash
# SSH into your production database
# Run the enable script
psql $DATABASE_URL < scripts/enable-v3-pls.sql
```

### Option 3: Via API (If implemented)

```javascript
// Update pattern learning config via API
PUT /api/patterns/config
{
  "enabled": true,
  "shadow_mode": false,
  "min_confidence_to_suggest": 0.60,
  "min_confidence_to_act": 0.85
}
```

## How to Verify Pattern Learning is Working

### 1. Check Configuration Status
```sql
SELECT * FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode');
```

Expected result:
- `enabled` = 'true'
- `shadow_mode` = 'false'

### 2. Check Recent Pattern Creation
```sql
-- See recently created patterns
SELECT 
  id,
  pattern_type,
  trigger_text,
  response_template,
  confidence_score,
  created_at,
  created_from
FROM decision_patterns
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### 3. Check Pattern Learning Logs
```sql
-- Check if system is attempting to learn
SELECT * FROM pattern_execution_history
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Monitor Live Learning
Watch the logs for pattern learning activity:
```bash
# On Railway
railway logs | grep "PatternLearning"
```

## Pattern Creation Process

### What Happens When Operator Responds:

1. **OpenPhone Webhook Receives Outbound Message**
   - File: `/routes/openphone.ts`
   - Detects operator sent a message

2. **System Checks if Human Response**
   ```javascript
   const isHumanResponse = !operatorResponse.includes('[Automated Response]') &&
                          !operatorResponse.includes('🤖');
   ```

3. **Calls Pattern Learning Service**
   ```javascript
   await patternLearningService.learnFromHumanResponse(
     customerMessage,    // What customer asked
     operatorResponse,   // How operator responded
     [],                // Actions taken
     conversationId,    
     phoneNumber
   );
   ```

4. **Creates New Pattern**
   - Uses GPT-4 to extract template variables
   - Generalizes the response for reuse
   - Stores in `decision_patterns` table
   - Sets initial confidence at 50%
   - Pattern is INACTIVE by default

5. **Pattern Appears in V3-PLS Page**
   - Shows as a new automation card
   - Operator can enable/disable
   - Can edit trigger and response

## Manual Pattern Import

If automatic learning isn't working, you can import patterns manually:

### From CSV Export
1. Export messages from OpenPhone as CSV
2. Go to V3-PLS page → Import CSV
3. System analyzes conversations and creates patterns

### Manual Creation
1. Go to V3-PLS page
2. Click "Add Pattern" button
3. Enter trigger phrase and response template
4. Pattern is created immediately

## Troubleshooting

### Pattern Learning Not Working Checklist:

1. **Check if enabled:**
   ```sql
   SELECT config_key, config_value FROM pattern_learning_config WHERE config_key = 'enabled';
   ```

2. **Check webhook is receiving messages:**
   ```sql
   SELECT COUNT(*) FROM openphone_conversations WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

3. **Check for learning attempts:**
   ```sql
   SELECT COUNT(*) FROM conversation_messages WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

4. **Check for errors in logs:**
   ```bash
   railway logs | grep -E "PatternLearning|Failed to learn"
   ```

5. **Verify OpenPhone webhook URL:**
   - Should be: `https://your-backend.railway.app/api/openphone/webhook`
   - Must be configured in OpenPhone settings

## Best Practices for Pattern Learning

### For Automatic Learning to Work Well:

1. **Operators should respond naturally** - Don't use templates
2. **Include specific information** - Bay numbers, times, links
3. **Be consistent** - Similar responses for similar questions
4. **Avoid automated tags** - Don't include [Automated] or 🤖
5. **Complete responses** - Full answers in one message

### Pattern Quality Improves When:
- Same question gets similar responses
- Operators approve/reject suggestions
- Patterns get used successfully
- Confidence scores increase over time

## Configuration Recommendations

### For Initial Setup:
```sql
-- Conservative settings for safety
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';
UPDATE pattern_learning_config SET config_value = '0.60' WHERE config_key = 'min_confidence_to_suggest';
UPDATE pattern_learning_config SET config_value = '0.95' WHERE config_key = 'min_confidence_to_act';
UPDATE pattern_learning_config SET config_value = '1' WHERE config_key = 'min_occurrences_to_learn';
```

### After Testing:
```sql
-- More aggressive automation
UPDATE pattern_learning_config SET config_value = '0.50' WHERE config_key = 'min_confidence_to_suggest';
UPDATE pattern_learning_config SET config_value = '0.85' WHERE config_key = 'min_confidence_to_act';
```

## Expected Results

Once properly enabled, you should see:
1. **New patterns appearing** within minutes of operator responses
2. **Pattern cards in V3-PLS page** showing learned responses
3. **Gradual automation increase** as patterns gain confidence
4. **Less repetitive work** for operators

## Quick Enable Script

Create this script as `enable-pattern-learning.sql`:

```sql
-- Quick enable pattern learning
BEGIN;

-- Enable the system
UPDATE pattern_learning_config SET config_value = 'true' WHERE config_key = 'enabled';
UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'shadow_mode';

-- Set reasonable thresholds
UPDATE pattern_learning_config SET config_value = '0.60' WHERE config_key = 'min_confidence_to_suggest';
UPDATE pattern_learning_config SET config_value = '0.85' WHERE config_key = 'min_confidence_to_act';
UPDATE pattern_learning_config SET config_value = '1' WHERE config_key = 'min_occurrences_to_learn';

-- Verify changes
SELECT config_key, config_value, description
FROM pattern_learning_config
WHERE config_key IN ('enabled', 'shadow_mode', 'min_confidence_to_suggest', 'min_confidence_to_act')
ORDER BY config_key;

COMMIT;

-- Check for recent patterns
SELECT COUNT(*) as pattern_count, MAX(created_at) as last_created
FROM decision_patterns;
```

Run with: `psql $DATABASE_URL < enable-pattern-learning.sql`