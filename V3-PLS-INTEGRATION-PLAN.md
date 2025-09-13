# V3-PLS Safeguards Integration Plan
## Using Existing System Architecture

After reviewing the codebase, here's how the safeguards integrate with the CURRENT system:

## Current System Flow

```
OpenPhone Webhook → aiAutomationService → patternLearningService → Send Response
                  ↓                      ↓
            (processMessage)        (processMessage)
                  ↓                      ↓
            AI Automations          Pattern Matching
```

## Integration Points - Minimal Changes Required

### 1. ClubAI Signature - EASY FIX
**Current:** Responses go directly from `patternLearningService`
**Change Location:** `patternLearningService.ts` line ~1345

```typescript
// In generateResponseWithGPT4o() - before returning response
private addClubAISignature(response: string): string {
  // Don't add if already has signature
  if (response.includes('- ClubAI')) return response;
  return `${response}\n\n- ClubAI`;
}

// Update line 1330 & 1345:
response: this.addClubAISignature(result.response || this.fillResponseTemplate(...))
```

### 2. Operator Activity Tracking - USE EXISTING TABLES
**Current:** `openphone_conversations` table already tracks messages
**Enhancement:** Add columns to existing table (no new table needed!)

```sql
-- Just add to openphone_conversations
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS operator_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS operator_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS ai_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT FALSE;
```

**Integration in `openphone.ts` line ~443:**
```typescript
// Check if operator is active BEFORE calling patternLearningService
const isOperatorActive = await db.query(
  `SELECT operator_active, operator_last_message
   FROM openphone_conversations
   WHERE phone_number = $1
   AND operator_active = true
   AND operator_last_message > NOW() - INTERVAL '4 hours'`,
  [phoneNumber]
);

if (isOperatorActive.rows.length > 0) {
  logger.info('[Pattern] Skipping - operator active', { phoneNumber });
  return res.json({ success: true, message: 'Operator handling conversation' });
}
```

### 3. Negative Sentiment Detection - USE EXISTING patternSafetyService
**Current:** `patternSafetyService` already exists and checks safety!
**Location:** Already imported in `aiAutomationService.ts` line 8

```typescript
// aiAutomationService already uses it at line 193!
const safetyCheck = await patternSafetyService.checkMessageSafety(message);

// Just enhance patternSafetyService.checkMessageSafety():
async checkMessageSafety(message: string): Promise<SafetyResult> {
  // EXISTING: blacklist check

  // ADD: Negative sentiment check
  const negativePatterns = [
    /still.*(broken|not working)/i,
    /doesn't help/i,
    /(frustrated|annoyed|angry|terrible)/i,
    /(real person|human|operator)/i
  ];

  if (negativePatterns.some(p => p.test(message))) {
    return {
      safe: false,
      reason: 'negative_sentiment',
      alertType: 'escalate',
      suggestedResponse: `I understand you need more help than I can provide.
I'm connecting you with a human operator who will assist you shortly.

- ClubAI`
    };
  }

  // Continue existing safety checks...
}
```

### 4. Multi-Message Detection - USE EXISTING conversation tracking
**Location:** `openphone.ts` already groups messages!

```typescript
// In openphone.ts around line 290, it already checks time windows:
const existingConv = await db.query(`
  SELECT id, messages,
    CASE
      WHEN jsonb_array_length(messages) > 0
      THEN EXTRACT(EPOCH FROM (NOW() - (messages->-1->>'createdAt')::timestamp)) / 60
      ELSE EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
    END as minutes_since_last_message
  FROM openphone_conversations
  WHERE phone_number = $1
```

// Just add rapid message check:
const recentMessageCount = existingConv.rows[0]?.messages?.filter(
  m => new Date(m.createdAt) > new Date(Date.now() - 60000) // Last 60 seconds
).length || 0;

if (recentMessageCount >= 3) {
  logger.info('[Pattern] Multiple rapid messages - escalating', { phoneNumber });
  // Send escalation message
  return res.json({ success: true, message: 'Escalated to operator' });
}
```

### 5. Operator Takeover Detection - TRACK IN WEBHOOK
**Location:** `openphone.ts` line ~277 already identifies message direction!

```typescript
// When processing outbound messages (operator responses):
if (newMessage.direction === 'outbound' && !newMessage.text.includes('ClubAI')) {
  // This is an operator message!
  await db.query(`
    UPDATE openphone_conversations
    SET operator_active = true,
        operator_last_message = NOW(),
        conversation_locked = true
    WHERE phone_number = $1`,
    [phoneNumber]
  );

  logger.info('[Operator] Taking over conversation', { phoneNumber });
}
```

### 6. Smart Conversation Boundaries - ENHANCE EXISTING
**Current:** Uses 1-hour window (line 290-300)
**Change:** Make window topic-aware

```typescript
// In openphone.ts, enhance the window logic:
const getConversationWindow = (messageText: string): number => {
  // Booking patterns
  if (/book|reservation|tee time/i.test(messageText)) {
    return 240; // 4 hours for bookings
  }
  // Technical issues
  if (/broken|stuck|frozen|not working/i.test(messageText)) {
    return 120; // 2 hours for tech support
  }
  // Default
  return 60; // 1 hour for general questions
};

// Use in existing query:
const windowMinutes = getConversationWindow(messageData.body || '');
// WHERE minutes_since_last_message > ${windowMinutes}
```

## Implementation Order - Using What's Already There

### Phase 1: Quick Wins (2 hours)
1. **Add ClubAI signature** - 1 line change in `patternLearningService`
2. **Add operator tracking columns** - Simple migration to existing table
3. **Enhance safety service** - Add sentiment patterns to existing service

### Phase 2: Operator Awareness (4 hours)
1. **Track operator messages** - Update webhook handler for outbound
2. **Check before responding** - Add operator check before pattern processing
3. **Lock conversations** - Set 4-hour lockout after operator activity

### Phase 3: Smart Behaviors (4 hours)
1. **Multi-message detection** - Use existing message array
2. **Dynamic windows** - Replace hardcoded 60 with topic-aware function
3. **Escalation responses** - Return from safety service

## Key Files to Modify

1. **patternLearningService.ts**
   - Add ClubAI signature to responses (line ~1330, 1345)

2. **patternSafetyService.ts**
   - Add negative sentiment detection
   - Return escalation response

3. **openphone.ts**
   - Track operator activity (line ~277)
   - Check operator before AI (line ~420)
   - Multi-message detection (line ~300)
   - Dynamic conversation windows

4. **Migration file**
   ```sql
   -- 220_add_operator_tracking.sql
   ALTER TABLE openphone_conversations
   ADD COLUMN operator_active BOOLEAN DEFAULT FALSE,
   ADD COLUMN operator_last_message TIMESTAMP,
   ADD COLUMN ai_last_message TIMESTAMP,
   ADD COLUMN conversation_locked BOOLEAN DEFAULT FALSE,
   ADD COLUMN rapid_message_count INTEGER DEFAULT 0,
   ADD COLUMN customer_sentiment VARCHAR(20) DEFAULT 'neutral';
   ```

## Testing Existing Patterns

The 5 active patterns will automatically get safeguards:

1. **Gift Cards** → Will include "- ClubAI"
2. **Hours** → Won't respond if operator active
3. **Food/Drinks** → Will escalate on "still confused"
4. **Tech Support** → Won't double-respond after operator
5. **Access** → Will detect multi-message frustration

## No Breaking Changes

- Uses existing database tables
- Uses existing service structure
- Uses existing safety service
- Uses existing webhook flow
- Just adds checks and conditions

## Monitoring

Check existing logs:
```bash
railway logs | grep -E "Pattern|Operator|ClubAI"
```

## Rollback Plan

If issues:
```sql
-- Remove operator tracking
ALTER TABLE openphone_conversations
DROP COLUMN IF EXISTS operator_active,
DROP COLUMN IF EXISTS operator_last_message,
DROP COLUMN IF EXISTS ai_last_message,
DROP COLUMN IF EXISTS conversation_locked;

-- Disable in config
UPDATE pattern_learning_config
SET config_value = 'false'
WHERE config_key = 'include_clubai_signature';
```