# V3-PLS Pattern Creation & Display Flow

## Overview
V3-PLS (Pattern Learning System) is an AI-powered message automation system that learns from operator responses and automatically creates patterns for common customer inquiries.

## How New Patterns Are Created

### 1. **Trigger: Customer Message Arrives**
When a customer sends a message via OpenPhone:
- Message arrives at OpenPhone webhook
- System checks if pattern learning is enabled
- PatternLearningService processes the message

### 2. **Pattern Matching Process**
```
Customer Message → Generate Signature → Search for Matching Pattern
                                      ↓
                           Found? → Execute Pattern
                              ↓
                         Not Found? → Escalate to Operator
                                    ↓
                              Operator Responds
                                    ↓
                         LEARNING OPPORTUNITY!
```

### 3. **Learning from Operator Response**
When an operator responds to a message with no matching pattern:

#### With GPT-4 (Primary Method):
```javascript
// patternLearningService.ts - createNewPatternFromInteraction()
1. GPT-4 analyzes the interaction
2. Extracts template variables:
   - {{customer_name}}
   - {{bay_number}}
   - {{time}}, {{date}}, {{location}}
3. Determines pattern type (booking, tech_issue, hours, etc.)
4. Creates reusable response template
5. Stores in decision_patterns table
```

#### Without GPT-4 (Fallback):
```javascript
// patternLearningService.ts - createBasicPattern()
1. Extract keywords from message
2. Determine pattern type from keywords
3. Store exact response as template
4. Mark with low confidence (0.50)
```

### 4. **Database Storage**
New patterns are stored in `decision_patterns` table:
```sql
INSERT INTO decision_patterns (
  pattern_type,           -- 'booking', 'tech_issue', 'hours', etc.
  pattern_signature,      -- MD5 hash for deduplication
  trigger_text,          -- Original customer message
  trigger_keywords,      -- ['trackman', 'frozen', 'stuck']
  response_template,     -- "I'll reset bay {{bay_number}} for you..."
  confidence_score,      -- Starts at 0.50
  auto_executable,       -- false (requires approval first)
  is_active             -- false (disabled by default)
)
```

## How Patterns Appear in V3-PLS UI

### 1. **Frontend Request**
When operator opens Operations → V3-PLS tab:
```javascript
// PatternAutomationCards.tsx
fetchAutomations() → GET /api/patterns
```

### 2. **Backend Processing**
```javascript
// routes/patterns.ts
1. Query all patterns from decision_patterns
2. Include execution statistics
3. Format with metadata
4. Return to frontend
```

### 3. **UI Display**
Each pattern becomes a card in the UI:

```typescript
// PatternAutomationCards.tsx - formatPatternAsAutomation()
Pattern Card Shows:
├── Icon (based on pattern_type)
├── Name (e.g., "Technical Support")
├── Description (auto-generated)
├── Trigger Keywords
├── Response Template
├── Statistics
│   ├── Execution Count
│   ├── Success Rate
│   └── Confidence Score
└── Controls
    ├── Toggle Active/Inactive
    ├── Edit Trigger & Response
    └── Delete Pattern
```

### 4. **Pattern Categories & Icons**
```javascript
- gift_cards     → 🎁 Gift Card Inquiries
- hours         → 🕐 Hours of Operation  
- booking       → 📅 Booking Assistance
- tech_issue    → 🔧 Technical Support
- membership    → 💳 Membership Information
- pricing       → 💵 Pricing Questions
- access        → 🚪 Access Issues
- general       → 💬 General Inquiry
```

## Pattern Lifecycle

### Stage 1: Learning (Confidence 0.00-0.40)
- Pattern created from operator response
- Disabled by default
- Appears in UI but inactive
- Operator can review and enable

### Stage 2: Suggesting (Confidence 0.40-0.60)
- Pattern suggests responses
- Requires operator approval
- Learns from modifications

### Stage 3: Queueing (Confidence 0.60-0.85)
- Pattern queues for operator review
- Can be auto-approved after timeout
- Builds confidence with each success

### Stage 4: Auto-Execute (Confidence 0.85+)
- Pattern executes automatically
- No operator intervention needed
- Still tracks success/failure

## Confidence Evolution

### Increases Confidence:
- Operator approves suggested response: +0.15
- Operator modifies but uses response: +0.10
- Pattern executes successfully: +0.15

### Decreases Confidence:
- Operator rejects suggestion: -0.20
- Pattern execution fails: -0.20
- Daily decay if unused: -0.01

## Safety Controls

### Pattern Creation Safety:
1. **Blacklisted Topics**: Never create patterns for:
   - Medical, legal, refund issues
   - Emergency situations
   - Sensitive personal data

2. **Approval Threshold**: New patterns require:
   - 10 successful uses before auto-execution
   - Operator approval for first uses
   - Minimum 5 similar examples

3. **Escalation Keywords** trigger alerts:
   - "angry", "lawyer", "emergency"
   - "manager", "complaint", "sue"

## Real Example Flow

### Customer Message:
"The trackman in bay 3 is frozen"

### No Pattern Found → Operator Responds:
"I'll reset the trackman in bay 3 for you right now. It should be working again in about 30 seconds."

### V3-PLS Creates Pattern:
```json
{
  "pattern_type": "tech_issue",
  "trigger_keywords": ["trackman", "frozen", "bay"],
  "response_template": "I'll reset the trackman in bay {{bay_number}} for you right now. It should be working again in about 30 seconds.",
  "confidence_score": 0.50,
  "auto_executable": false
}
```

### Pattern Appears in UI:
- Shows as "Technical Support" card
- Displays trigger: "trackman frozen bay"
- Shows response template
- Toggle is OFF (inactive)
- Confidence bar at 50%

### Next Time Similar Message Arrives:
"Trackman stuck in bay 5"
- Pattern matches (semantic similarity)
- Suggests response with bay_number = 5
- Operator approves → Confidence increases to 0.65
- After 10 approvals → Auto-executes

## Monitoring & Analytics

### V3-PLS Dashboard Shows:
- Total Patterns: 158
- Active Patterns: 142
- Executions Today: 234
- Success Rate: 92%
- Time Saved: 3.5 hours/day
- Common Questions Chart
- Peak Message Times Graph

## Best Practices

### For Operators:
1. **Be Consistent**: Use similar responses for similar issues
2. **Include Variables**: Use specific values that can be templated
3. **Review New Patterns**: Check V3-PLS tab daily for new patterns
4. **Provide Feedback**: Approve/reject suggestions to train the system

### For Admins:
1. **Monitor Safety Settings**: Check blacklist and escalation keywords
2. **Review Pattern Performance**: Disable poorly performing patterns
3. **Set Appropriate Thresholds**: Balance automation vs. safety
4. **Export Successful Patterns**: Share across locations

## Troubleshooting

### Pattern Not Creating:
- Check if pattern learning is enabled
- Verify operator actually responded (not just internal note)
- Check if response was too short (<20 characters)
- Ensure not a blacklisted topic

### Pattern Not Matching:
- Verify pattern is active (toggle ON)
- Check confidence score (needs >0.60 to suggest)
- Look at trigger keywords
- Test with exact original message first

### Pattern Not in UI:
- Refresh the page
- Check browser console for errors
- Verify database has patterns: `SELECT COUNT(*) FROM decision_patterns`
- Check API response: Network tab → patterns request

## Technical Details

### Files Involved:
```
Backend:
├── services/patternLearningService.ts    # Core learning logic
├── services/patternSafetyService.ts      # Safety controls
├── routes/patterns.ts                    # API endpoints
├── routes/patterns-enhanced.ts           # Enhanced features
└── migrations/201_pattern_learning.sql   # Database schema

Frontend:
├── pages/operations.tsx                           # Main operations page
├── components/operations/patterns/
│   ├── OperationsPatternsEnhanced.tsx            # Container component
│   ├── PatternAutomationCards.tsx                # Pattern cards UI
│   └── PatternsStatsAndSettings.tsx              # Stats & controls
```

### API Endpoints:
```
GET    /api/patterns          # List all patterns
GET    /api/patterns/stats    # Pattern statistics
POST   /api/patterns          # Create new pattern
PUT    /api/patterns/:id      # Update pattern
DELETE /api/patterns/:id      # Delete pattern
```

### Database Schema:
```sql
decision_patterns
├── id                  # Unique identifier
├── pattern_type        # Category
├── trigger_text        # Original message
├── trigger_keywords[]  # Search terms
├── response_template   # Response with variables
├── confidence_score    # 0.00-1.00
├── auto_executable     # Can run without approval
├── is_active          # Enabled/disabled
├── execution_count    # Times used
└── success_count      # Successful uses
```

## Future Enhancements

### Coming Soon:
1. Pattern versioning (track changes over time)
2. A/B testing (try different responses)
3. Multi-location pattern sharing
4. Voice message pattern learning
5. Image-based issue detection
6. Predictive pattern suggestions
7. Pattern performance reports
8. Bulk pattern import/export