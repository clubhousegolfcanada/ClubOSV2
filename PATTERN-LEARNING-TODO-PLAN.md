# Pattern Learning System - Implementation Todo List
## Created: 2025-09-05

## ✅ WHAT EXISTS (Verified)

### Learning Mechanisms ✅
- `learnFromHumanResponse()` - IMPLEMENTED and called when operators modify
- `updatePatternFromHumanResponse()` - EXISTS 
- `updatePatternConfidence()` - EXISTS
- Operator actions ARE logged when modify/accept/reject

### Customer Intelligence ✅  
- `customer_profiles` table EXISTS with:
  - Display name, bio, handicap
  - Home location, preferences
  - Total rounds, stats visibility
- BUT: NOT used by Pattern Learning System ❌

### Context Features ⚠️
- Conversation history IS fetched (last 10 messages)
- BUT: Used AFTER pattern selection, not BEFORE ❌
- No time/situation awareness ❌

## 🔴 CRITICAL FIXES NEEDED

### Phase 1: Fix Context Usage (2 hours)
- [ ] Move conversation history fetch BEFORE pattern matching
- [ ] Include last 3-5 messages in pattern selection
- [ ] Pass conversation context to findMatchingPatterns()
- [ ] Test with "Thanks" after cancellation scenario

### Phase 2: Connect Customer Profiles (1 hour)
- [ ] Link phone numbers to customer_profiles
- [ ] Include customer data in pattern context
- [ ] Use handicap/location/preferences for personalization
- [ ] Add customer history to GPT-4o prompts

### Phase 3: Save What Actually Happens (2 hours)
- [ ] Save response_sent in pattern_execution_history
- [ ] Track if customer replied (positive/negative/none)
- [ ] Record operator interventions
- [ ] Log resolution outcomes

## 📋 IMPLEMENTATION TODOS

### Week 1: Core Fixes
```
Monday:
□ Fix conversation context usage in pattern matching
□ Test with problematic "sword" scenario
□ Deploy and monitor

Tuesday:  
□ Connect customer_profiles to pattern learning
□ Add customer context to GPT-4o reasoning
□ Test personalized responses

Wednesday:
□ Start saving actual responses sent
□ Track customer reactions
□ Create pattern_outcomes table

Thursday:
□ Implement confidence decay for unused patterns
□ Add success metrics tracking
□ Connect feedback loops properly

Friday:
□ Test complete learning cycle
□ Document what's working
□ Deploy to production
```

### Week 2: Intelligence Layer
```
□ Build customer preference profiles
□ Add time/day context awareness
□ Implement A/B testing framework
□ Create pattern performance dashboard
□ Add anomaly detection
```

### Week 3: Advanced Learning
```
□ Pattern evolution based on success
□ Automatic pattern merging
□ Confidence auto-adjustment
□ Pattern retirement system
□ Multi-variate testing
```

## 🚀 QUICK WINS (Do Today)

### 1. Fix Context Bug (30 min)
```typescript
// patternLearningService.ts line ~160
async processMessage() {
  // MOVE THIS BEFORE findMatchingPatterns
  const conversationHistory = await this.getConversationHistory(conversationId);
  
  // Pass to pattern matching
  const patterns = await this.findMatchingPatterns(
    message,
    signature, 
    conversationHistory // ADD THIS PARAM
  );
}
```

### 2. Use Customer Profiles (1 hour)
```typescript
// Add to buildTemplateContext()
const customerProfile = await db.query(
  `SELECT * FROM customer_profiles cp
   JOIN users u ON u.id = cp.user_id  
   WHERE u.phone_number = $1`,
  [phoneNumber]
);

context.customer_profile = customerProfile.rows[0];
context.is_member = customerProfile.rows[0]?.membership_status === 'active';
context.total_visits = customerProfile.rows[0]?.total_rounds || 0;
```

### 3. Track Outcomes (30 min)
```sql
CREATE TABLE pattern_outcomes (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES pattern_execution_history(id),
  pattern_id INTEGER,
  customer_replied BOOLEAN,
  reply_sentiment VARCHAR(20),
  operator_intervened BOOLEAN,
  issue_resolved BOOLEAN,
  time_to_resolution INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 📊 SUCCESS METRICS

Track these daily:
1. Pattern match accuracy (target: 75%+)
2. Nonsensical response rate (target: <5%)
3. Operator override rate (target: <20%)
4. Customer satisfaction (positive replies)
5. Auto-resolution rate (target: 40%+)

## 🎯 PRIORITY ORDER

1. **TODAY**: Fix conversation context bug (sword issue)
2. **TOMORROW**: Connect customer profiles
3. **THIS WEEK**: Start tracking outcomes
4. **NEXT WEEK**: Build intelligence layer
5. **MONTH**: Full learning system

## 💡 KEY INSIGHT

**The infrastructure EXISTS but isn't CONNECTED:**
- Learning functions exist but need better triggers
- Customer data exists but isn't used
- Context is fetched but at wrong time

**It's mostly plumbing work, not new development!**