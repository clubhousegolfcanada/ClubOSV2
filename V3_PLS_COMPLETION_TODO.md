# V3-PLS Pattern Learning System - Full Implementation TODO
*Created: September 2, 2025*

## 🎯 Goal
Transform the current basic pattern matching into the intelligent V3-PLS system with GPT-4 powered understanding, semantic matching, and confidence evolution.

## Current State Assessment
- ✅ Database tables created (decision_patterns, pattern_execution_history, etc.)
- ✅ Pattern learning service exists and is integrated with OpenPhone webhooks
- ✅ OpenAI API configured in Railway production
- ✅ 158 patterns learned from conversations
- ❌ Patterns are low-quality (no GPT-4 processing, just raw text)
- ❌ No semantic matching (only exact text matching)
- ❌ No template variables (verbatim responses only)
- ❌ No confidence evolution (all stuck at 0.50)
- ❌ Pattern learning only triggers for outbound messages in existing conversations

## 📋 Implementation Tasks

### Phase 1: Fix Existing Patterns (Week 1)

#### Task 1.1: Deploy GPT-4 Upgrade Script
**File:** `scripts/upgrade-patterns-gpt4.ts` (already created)
**Actions:**
- [ ] Commit upgrade script to repository
- [ ] Deploy to Railway
- [ ] Run script in Railway environment where OpenAI is configured
- [ ] Verify patterns now have templates with variables ({{bay_number}}, {{time}}, etc.)
- [ ] Confirm patterns have extracted entities and context

#### Task 1.2: Implement Variable Replacement System
**File to modify:** `src/services/patternLearningService.ts`
**Add function:**
```typescript
private fillTemplate(template: string, context: Record<string, any>): string {
  // Replace {{variable}} with actual values
  // Handle missing variables gracefully
  // Support nested objects ({{customer.name}})
}
```
**Test cases:**
- [ ] Test with bay numbers
- [ ] Test with times and dates
- [ ] Test with customer names
- [ ] Test with missing variables

#### Task 1.3: Fix Pattern Learning for New Conversations
**File to modify:** `src/routes/openphone.ts`
**Current issue:** Pattern learning only happens for outbound messages in existing conversations
**Fix:** Add pattern learning for outbound messages in new conversations too
- [ ] Find where new conversations are created
- [ ] Add same pattern learning logic for outbound messages
- [ ] Test with new conversation scenarios

### Phase 2: Add Semantic Matching (Week 1-2)

#### Task 2.1: Implement Embedding Generation
**File to modify:** `src/services/patternLearningService.ts`
**Add:**
```typescript
private async generateEmbedding(text: string): Promise<number[]> {
  // Use OpenAI text-embedding-3-small
  // Cache embeddings for performance
  // Handle rate limits
}
```
- [ ] Add embedding column to decision_patterns table
- [ ] Generate embeddings for all existing patterns
- [ ] Add embedding generation to new pattern creation

#### Task 2.2: Implement Semantic Search
**File to modify:** `src/services/patternLearningService.ts`
**Replace:** Current MD5 hash matching
**With:** Semantic similarity search
```typescript
private async findSemanticMatches(message: string, threshold: number = 0.85): Promise<Pattern[]> {
  // Generate embedding for incoming message
  // Calculate cosine similarity with stored patterns
  // Return patterns above threshold
  // Combine with keyword matching for hybrid approach
}
```
- [ ] Install vector similarity library (pgvector or similar)
- [ ] Update findMatchingPatterns to use semantic search
- [ ] Test with similar but not identical messages

#### Task 2.3: Create Pattern Clustering
**Purpose:** Group similar patterns to avoid duplicates
- [ ] Identify duplicate/similar patterns
- [ ] Merge similar patterns into single templates
- [ ] Update confidence based on combined execution history

### Phase 3: Implement Confidence Evolution (Week 2)

#### Task 3.1: Add Success/Failure Tracking
**File to modify:** `src/routes/openphone.ts` and `src/routes/messages.ts`
**Track:**
- [ ] When automated responses are sent
- [ ] When operators override/modify responses
- [ ] When customers respond positively/negatively
- [ ] When issues escalate after automation

#### Task 3.2: Implement Confidence Updates
**File to modify:** `src/services/patternLearningService.ts`
**Implement:**
```typescript
async updatePatternConfidence(patternId: number, outcome: 'success' | 'failure' | 'modified') {
  // Success: +0.05 confidence
  // Modified: +0.02 confidence
  // Failure: -0.10 confidence
  // Update auto_executable flag at 0.95 confidence
}
```
- [ ] Create trigger to call after pattern execution
- [ ] Add confidence_evolution tracking
- [ ] Set up daily confidence decay for unused patterns

#### Task 3.3: Add Feedback Loop
**Create:** API endpoint for operator feedback
- [ ] POST /api/patterns/:id/feedback
- [ ] Track "helpful" vs "not helpful"
- [ ] Allow operators to correct responses
- [ ] Learn from corrections

### Phase 4: Enhance Context Understanding (Week 2-3)

#### Task 4.1: Multi-Message Context
**Current:** Each message processed independently
**Goal:** Understand conversation context
- [ ] Pass last 3 messages to GPT-4 for context
- [ ] Extract conversation state (greeting, negotiating, closing, etc.)
- [ ] Adjust responses based on conversation flow

#### Task 4.2: Customer History Context
**Add customer-specific learning:**
- [ ] Track customer preferences
- [ ] Remember previous issues
- [ ] Personalize responses based on history
- [ ] Identify VIP/problem customers

#### Task 4.3: Temporal Context
**Add time-based intelligence:**
- [ ] Day of week patterns
- [ ] Time of day patterns
- [ ] Holiday/special event handling
- [ ] Seasonal variations

### Phase 5: Advanced Pattern Features (Week 3)

#### Task 5.1: Action Execution
**Current:** Only response generation
**Goal:** Execute actions automatically
- [ ] Parse action_template JSON
- [ ] Implement action executors (reset_bay, send_code, create_ticket)
- [ ] Add safety checks and rollback
- [ ] Track action success rates

#### Task 5.2: Pattern Chaining
**Enable multi-step conversations:**
- [ ] Link related patterns
- [ ] Support follow-up questions
- [ ] Maintain conversation state
- [ ] Handle clarifications

#### Task 5.3: Proactive Patterns
**Predict and prevent issues:**
- [ ] Identify patterns that lead to problems
- [ ] Send proactive messages
- [ ] Alert operators to potential issues
- [ ] Schedule preventive actions

### Phase 6: UI and Monitoring (Week 3-4)

#### Task 6.1: Pattern Management Dashboard
**Create:** `/pages/operations/patterns-dashboard.tsx`
**Features:**
- [ ] View all patterns with stats
- [ ] Edit pattern templates
- [ ] Adjust confidence thresholds
- [ ] Enable/disable patterns
- [ ] View execution history
- [ ] Export/import patterns

#### Task 6.2: Real-time Monitoring
**Create:** Pattern execution monitor
- [ ] Live feed of pattern matches
- [ ] Success/failure rates
- [ ] Confidence evolution graphs
- [ ] Anomaly alerts
- [ ] Performance metrics

#### Task 6.3: Analytics and Reporting
**Track ROI and effectiveness:**
- [ ] Time saved per pattern
- [ ] Automation rate over time
- [ ] Customer satisfaction scores
- [ ] Error rates and causes
- [ ] Operator override patterns

### Phase 7: Testing and Optimization (Week 4)

#### Task 7.1: Create Test Suite
**Write tests for:**
- [ ] Pattern matching accuracy
- [ ] Variable replacement
- [ ] Confidence evolution
- [ ] Edge cases
- [ ] Performance under load

#### Task 7.2: Shadow Mode Testing
**Run parallel to production:**
- [ ] Log what system would do
- [ ] Compare to operator actions
- [ ] Calculate accuracy
- [ ] Identify gaps

#### Task 7.3: Performance Optimization
**Optimize for scale:**
- [ ] Cache frequently used patterns
- [ ] Optimize embedding searches
- [ ] Batch GPT-4 calls
- [ ] Database query optimization

### Phase 8: Production Rollout (Week 5)

#### Task 8.1: Gradual Enablement
**Progressive rollout:**
- [ ] Week 1: FAQ patterns only (low risk)
- [ ] Week 2: Add booking confirmations
- [ ] Week 3: Add technical issues
- [ ] Week 4: Full automation

#### Task 8.2: Monitoring and Adjustment
**Daily monitoring:**
- [ ] Review automation logs
- [ ] Adjust confidence thresholds
- [ ] Disable problematic patterns
- [ ] Collect operator feedback

#### Task 8.3: Documentation
**Create documentation:**
- [ ] Operator guide
- [ ] Admin configuration guide
- [ ] Troubleshooting guide
- [ ] API documentation

## 🎯 Success Metrics

### Week 1 Goals:
- [ ] 100% of patterns upgraded with GPT-4
- [ ] Variable replacement working
- [ ] Basic semantic matching implemented

### Week 2 Goals:
- [ ] Confidence evolution active
- [ ] 50% pattern match rate (up from current ~5%)
- [ ] Operator feedback system live

### Week 3 Goals:
- [ ] 70% pattern match rate
- [ ] Action execution working
- [ ] UI dashboard complete

### Week 4 Goals:
- [ ] 80% pattern match rate
- [ ] Full test coverage
- [ ] Shadow mode validation complete

### Week 5 Goals:
- [ ] Production deployment
- [ ] 60% automation rate achieved
- [ ] Positive operator feedback

## 🚨 Critical Path Items

These MUST be done first:
1. **Run GPT-4 upgrade script** - Without this, patterns are useless
2. **Implement variable replacement** - Required for dynamic responses
3. **Add semantic matching** - Required for practical match rates
4. **Enable confidence evolution** - Required for automation decisions

## 📝 Notes for Next Session

When you start the new context window:
1. Begin with running the GPT-4 upgrade script on Railway
2. Check the results - confirm patterns have templates
3. Implement variable replacement
4. Test with real messages
5. Move to semantic matching

Key files to focus on:
- `/src/services/patternLearningService.ts` - Core logic
- `/src/routes/openphone.ts` - Message processing
- `/scripts/upgrade-patterns-gpt4.ts` - Pattern upgrade
- `/src/routes/patterns.ts` - API endpoints

Environment requirements:
- Must have OpenAI API key configured
- Must run upgrade script where OpenAI is available
- Need database access for pattern updates

## 🔗 Related Documentation

Reference these files for context:
- `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/ClubOS/V3_TRUE_REVOLUTIONARY_POTENTIAL.md`
- `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/ClubOS/V1_PATTERN_LEARNING_INTEGRATION.md`
- `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/PATTERN_LEARNING_IMPLEMENTATION.md`

## 💡 Remember

The goal is not perfection, but practical automation that:
- Reduces operator workload by 60-80%
- Learns from every interaction
- Gets better over time
- Always allows human override

Start conservative, build confidence through success.

---

*This TODO represents approximately 4-5 weeks of development work to fully implement the V3-PLS vision in V1.*