# V3-PLS Safeguards Audit & Implementation Plan

## Current State Analysis

### Active Patterns (5 Patterns Currently Responding)
1. **Gift Card Inquiries** - "Do you sell gift cards?" → Links to purchase
2. **Hours of Operation** - "What are your hours?" → 24/7 info + booking link
3. **FAQ - Food/Drinks** - "Can I bring food and drinks?" → Policy explanation
4. **Technical Support** - "trackman frozen stuck not working" → Remote reset offer
5. **Access Issues** - "How do I get in?" → Door code explanation

### Critical Safety Gaps Identified

#### 1. NO Conversation Awareness
- **Issue**: PLS responds even when operator is actively chatting
- **Risk**: Customer confusion, duplicate/conflicting responses
- **Current**: No tracking of operator activity in conversation

#### 2. NO AI Signature
- **Issue**: Customers don't know they're talking to AI
- **Risk**: Trust issues, frustration when AI can't help
- **Current**: Responses have no "ClubAI" identifier

#### 3. NO Negative Feedback Detection
- **Issue**: AI keeps responding even when customer is frustrated
- **Risk**: Escalating customer anger, poor experience
- **Current**: No sentiment analysis or complaint detection

#### 4. NO Operator Takeover Detection
- **Issue**: AI continues after operator starts helping
- **Risk**: Confusing double responses, undermines operator
- **Current**: No detection of operator intervention

#### 5. Poor Conversation Boundaries
- **Issue**: 1-hour window too short for bookings (3-4 hours)
- **Risk**: Conversations split incorrectly for repeat customers
- **Current**: Simple time-based grouping, no context

#### 6. Missing API Endpoints
- **Issue**: Queue and operator feedback systems broken
- **Risk**: Can't review or control AI suggestions
- **Current**: `/api/patterns/queue` endpoints don't exist

## Implementation Plan

### Phase 1: Immediate Safety Controls (Priority 1)

#### 1.1 Add ClubAI Signature
```typescript
// In patternLearningService.ts - formatResponse()
const addClubAISignature = (response: string): string => {
  return `${response}\n\n- ClubAI`;
};
```

#### 1.2 Operator Activity Tracking
```sql
-- New table: operator_activity
CREATE TABLE operator_activity (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL,
  conversation_id VARCHAR(255),
  operator_id INTEGER REFERENCES users(id),
  last_response_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_operator_activity_phone ON operator_activity(phone_number, is_active);
```

#### 1.3 Conversation Lockout System
```typescript
interface ConversationState {
  phoneNumber: string;
  operatorActive: boolean;
  operatorLastSeen: Date;
  aiLastResponded: Date;
  customerSentiment: 'positive' | 'neutral' | 'negative';
  messageCount: number;
  lockoutUntil?: Date;
}
```

### Phase 2: Smart Conversation Boundaries

#### 2.1 Context-Aware Grouping
- Booking duration: 4-hour window
- Support issues: 2-hour window
- General questions: 1-hour window
- Detect topic changes for new conversation

#### 2.2 Repeat Customer Handling
```typescript
// Detect conversation restart patterns
const isNewConversation = (messages: Message[]): boolean => {
  const triggers = [
    /^(hi|hello|hey)/i,
    /book.*time/i,
    /new.*issue/i,
    /different.*problem/i
  ];
  // Check if message matches new conversation pattern
  return triggers.some(t => t.test(lastMessage.text));
};
```

### Phase 3: Negative Feedback & Escalation

#### 3.1 Sentiment Detection
```typescript
const negativeIndicators = [
  'not working', 'still broken', 'doesn\'t help',
  'frustrated', 'annoyed', 'terrible',
  'speak to human', 'real person', 'operator'
];

const detectNegativeSentiment = async (message: string): Promise<boolean> => {
  // Quick keyword check
  if (negativeIndicators.some(ind => message.toLowerCase().includes(ind))) {
    return true;
  }

  // GPT-4o sentiment analysis for unclear cases
  if (openai) {
    const sentiment = await analyzeSentiment(message);
    return sentiment === 'negative';
  }

  return false;
};
```

#### 3.2 Auto-Escalation Response
```typescript
const ESCALATION_RESPONSE = `I understand you need more help than I can provide.
I'm connecting you with a human operator who will assist you shortly.

A member of our team will respond as soon as possible.

- ClubAI`;
```

### Phase 4: Operator Takeover Detection

#### 4.1 Track Operator Messages
```typescript
// In OpenPhone webhook handler
if (direction === 'outbound' && !message.includes('ClubAI')) {
  // This is an operator message
  await markOperatorActive(phoneNumber, conversationId);
  await disableAIForConversation(phoneNumber, 4 * 60 * 60 * 1000); // 4 hours
}
```

#### 4.2 AI Backoff Logic
```typescript
const shouldAIRespond = async (phoneNumber: string): Promise<boolean> => {
  // Check operator activity
  const operatorActive = await isOperatorActive(phoneNumber);
  if (operatorActive) return false;

  // Check recent AI responses
  const recentAIResponse = await getLastAIResponse(phoneNumber);
  if (recentAIResponse && minutesSince(recentAIResponse) < 5) {
    return false; // Don't respond too frequently
  }

  // Check customer sentiment
  const sentiment = await getConversationSentiment(phoneNumber);
  if (sentiment === 'negative') return false;

  return true;
};
```

### Phase 5: Multi-Message Detection

#### 5.1 Rapid Message Detection
```typescript
// Track message velocity
const detectRapidMessages = async (phoneNumber: string): Promise<boolean> => {
  const recentMessages = await getRecentMessages(phoneNumber, 60); // Last 60 seconds
  return recentMessages.length > 2; // Multiple messages = confusion/frustration
};
```

#### 5.2 Context Continuity
```typescript
// Don't respond to follow-up clarifications
const isFollowUp = (currentMsg: string, previousMsg: string): boolean => {
  const followUpPatterns = [
    /^(also|and|oh|wait|actually|sorry)/i,
    /^i mean/i,
    /^forgot to/i
  ];
  return followUpPatterns.some(p => p.test(currentMsg));
};
```

## Database Migrations Required

```sql
-- Migration: Add conversation state tracking
CREATE TABLE conversation_states (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(50) UNIQUE NOT NULL,
  conversation_id VARCHAR(255),
  operator_active BOOLEAN DEFAULT FALSE,
  operator_last_seen TIMESTAMP,
  ai_last_responded TIMESTAMP,
  customer_sentiment VARCHAR(20) DEFAULT 'neutral',
  message_count INTEGER DEFAULT 0,
  lockout_until TIMESTAMP,
  conversation_topic VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration: Add AI response tracking
ALTER TABLE openphone_conversations
ADD COLUMN ai_responded BOOLEAN DEFAULT FALSE,
ADD COLUMN operator_responded BOOLEAN DEFAULT FALSE,
ADD COLUMN last_ai_response TIMESTAMP,
ADD COLUMN last_operator_response TIMESTAMP;

-- Migration: Pattern response tracking
ALTER TABLE decision_patterns
ADD COLUMN include_signature BOOLEAN DEFAULT TRUE,
ADD COLUMN max_uses_per_conversation INTEGER DEFAULT 1,
ADD COLUMN cooldown_minutes INTEGER DEFAULT 30;
```

## Configuration Updates

```typescript
// pattern_learning_config updates
const SAFEGUARD_CONFIG = {
  // Conversation boundaries
  'booking_window_hours': '4',
  'support_window_hours': '2',
  'general_window_hours': '1',

  // AI behavior
  'include_clubai_signature': 'true',
  'max_responses_per_conversation': '3',
  'response_cooldown_minutes': '5',

  // Escalation
  'auto_escalate_on_negative': 'true',
  'operator_lockout_hours': '4',
  'multi_message_threshold': '3',

  // Safety
  'disable_on_operator_activity': 'true',
  'sentiment_analysis_enabled': 'true'
};
```

## Testing Plan

1. **Operator Interference Test**
   - AI responds to initial message
   - Operator sends message
   - Customer sends another trigger
   - Verify: AI does NOT respond

2. **Negative Sentiment Test**
   - Customer: "How do I get in?"
   - AI: Provides door code info
   - Customer: "This doesn't work"
   - Verify: AI escalates to human

3. **Multi-Message Test**
   - Customer sends 3 messages rapidly
   - Verify: AI waits or escalates

4. **Signature Test**
   - All AI responses end with "- ClubAI"

5. **Conversation Boundary Test**
   - 4-hour booking conversation
   - Verify: Not split incorrectly

## Rollout Strategy

### Week 1
- Implement ClubAI signature
- Add operator activity tracking
- Deploy conversation lockout

### Week 2
- Sentiment detection
- Auto-escalation responses
- Multi-message detection

### Week 3
- Smart conversation boundaries
- Repeat customer handling
- Full testing suite

### Week 4
- Monitor and adjust thresholds
- Gather operator feedback
- Fine-tune safety controls

## Success Metrics

- **Operator Override Rate**: Target < 10%
- **Customer Complaints**: Reduce by 50%
- **Double Response Issues**: Eliminate completely
- **Escalation Success**: 95% handled within 5 min
- **AI Identification**: 100% of responses signed

## Risk Mitigation

1. **Shadow Mode First**: Test all changes in shadow mode
2. **Gradual Rollout**: Enable per location/pattern
3. **Kill Switch**: Global disable if issues arise
4. **Operator Training**: Educate on new AI behavior
5. **Customer Communication**: Announce ClubAI assistant