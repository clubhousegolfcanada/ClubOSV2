# Self-Learning SOP Module: Complete Integration Guide

## Overview
The Learning SOP Module creates a self-improving knowledge base that:
- **Captures** knowledge from Slack, chat, and tickets
- **Analyzes** patterns to identify gaps
- **Suggests** updates based on real interactions
- **Learns** from employee responses and customer feedback

## Architecture

```
                    Knowledge Sources
                           ↓
    ┌─────────────┬────────────────┬──────────────┐
    │   Slack     │     Chat       │   Tickets    │
    │ Responses   │  Interactions  │ Resolutions  │
    └──────┬──────┴───────┬────────┴──────┬───────┘
           ↓              ↓               ↓
        Knowledge Capture Queue
                  ↓
           GPT-4 Analysis
                  ↓
    ┌─────────────────────────────┐
    │  Pattern Recognition &      │
    │  Gap Identification         │
    └──────────┬──────────────────┘
               ↓
    ┌──────────────────┬─────────────────┐
    │  Update Existing  │  Create New     │
    │      SOPs        │     SOPs        │
    └─────────┬────────┴────────┬────────┘
              ↓                 ↓
         Review Queue      Draft Queue
              ↓                 ↓
    ┌─────────────────────────────────┐
    │     Claude/Admin Review         │
    └─────────────────────────────────┘
              ↓
         Apply Updates
              ↓
       Re-embed & Deploy
```

## Integration Points

### 1. Slack Integration
```typescript
// In slackFallback.ts, add after message is sent:
import { learningSOPModule } from '../services/learningSOPModule';

// When a thread is resolved
async function markThreadResolved(threadTs: string, resolution: string) {
  await learningSOPModule.learnFromSlackResolution({
    threadTs,
    originalQuery: thread.originalQuery,
    finalResolution: resolution,
    wasHelpful: true, // Can be determined by reactions
    resolver: message.user
  });
}
```

### 2. Chat Integration
```typescript
// In llm.ts route handler, after response:
if (processedRequest.llmResponse) {
  learningSOPModule.captureFromChat({
    query: userRequest.requestDescription,
    llmResponse: processedRequest.llmResponse,
    route: processedRequest.botRoute,
    sessionId: userRequest.sessionId,
    userFeedback: undefined // Set when user provides feedback
  }).catch(err => logger.error('Failed to capture knowledge:', err));
}
```

### 3. Ticket Resolution
```typescript
// In tickets.ts when ticket is resolved:
router.put('/:id/resolve', async (req, res) => {
  const { resolution } = req.body;
  
  // ... existing resolution logic ...
  
  // Capture knowledge
  await learningSOPModule.captureFromTicket({
    ticketId: ticket.id,
    title: ticket.title,
    description: ticket.description,
    resolution: resolution,
    category: ticket.category,
    resolvedBy: req.user.id
  });
});
```

### 4. Claude Review Interface
```typescript
// New route: /api/sop-learning/review
router.get('/pending-updates', authenticate, adminOnly, async (req, res) => {
  const updates = await learningSOPModule.getPendingUpdatesForReview();
  res.json({ updates });
});

router.post('/review/:updateId', authenticate, adminOnly, async (req, res) => {
  const { approved, modifiedContent, reviewNotes } = req.body;
  
  await learningSOPModule.reviewUpdate(req.params.updateId, {
    approved,
    modifiedContent,
    reviewNotes
  });
  
  res.json({ success: true });
});
```

## Configuration

### Environment Variables
```bash
# Learning Module Settings
LEARNING_MODULE_ENABLED=true
AUTO_APPLY_UPDATES=false          # High confidence updates auto-apply
KNOWLEDGE_BATCH_SIZE=10           # Process after N captures
CONFIDENCE_THRESHOLD=0.8          # Min confidence for suggestions
LEARNING_CHECK_INTERVAL=300000    # 5 minutes
```

### Feature Flags
```typescript
// Gradual rollout
const captureRate = parseFloat(process.env.LEARNING_CAPTURE_RATE || '0.1'); // 10%
if (Math.random() < captureRate) {
  await learningSOPModule.captureFromChat(data);
}
```

## Learning Examples

### Example 1: Access Card Issue
```
Customer: "My access card won't work at the door"
Agent: "Try holding the card flat against the reader for 3 seconds. If that doesn't work, the battery in the reader might be low - use the keypad backup code: #7823#"

System learns:
- New troubleshooting step (hold for 3 seconds)
- Backup access code not in current SOPs
- Updates Access_Control_Troubleshooting.md
```

### Example 2: New Equipment Issue Pattern
```
Multiple queries about "TrackMan showing offline"
Agents respond with various fixes
System identifies pattern → Creates new SOP section
```

## Monitoring & Analytics

### Dashboard Metrics
```sql
-- Knowledge capture rate
SELECT 
  DATE_TRUNC('day', created_at) as date,
  source,
  COUNT(*) as captures,
  AVG(confidence) as avg_confidence
FROM knowledge_captures
GROUP BY 1, 2
ORDER BY 1 DESC;

-- Update effectiveness
SELECT 
  assistant,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  AVG(confidence) as avg_confidence
FROM sop_update_queue
GROUP BY assistant;
```

### Event Monitoring
```typescript
learningSOPModule.on('knowledge:captured', (capture) => {
  logger.info('Knowledge captured', capture);
});

learningSOPModule.on('update:suggested', (update) => {
  // Send notification to Slack/admin
  notifyAdmin(`New SOP update suggested: ${update.reason}`);
});

learningSOPModule.on('sop:updated', (info) => {
  // Log successful update
  logger.info('SOP updated automatically', info);
});
```

## Claude's Role

### Daily Review Tasks
1. **Review Pending Updates**
   ```bash
   # Check for updates needing review
   GET /api/sop-learning/pending-updates
   
   # Review and approve/modify
   POST /api/sop-learning/review/{updateId}
   ```

2. **Quality Assurance**
   - Ensure tone consistency
   - Verify technical accuracy
   - Maintain brand voice
   - Add context where needed

3. **Pattern Analysis**
   ```typescript
   // Get learning metrics
   const metrics = await db.query(`
     SELECT metric_type, assistant, AVG(value) 
     FROM learning_metrics 
     WHERE created_at > NOW() - INTERVAL '7 days'
     GROUP BY metric_type, assistant
   `);
   ```

## Security & Safety

### Approval Workflow
```
Confidence < 0.8: Manual review required
Confidence 0.8-0.9: Admin notification
Confidence > 0.9: Auto-apply (if enabled)
```

### Backup System
- Every update creates timestamped backup
- 30-day retention for rollback
- Git commit for each approved change

### Content Validation
- No PII in SOPs
- Maintain professional tone
- Verify technical accuracy
- Preserve emergency procedures

## Benefits

### Immediate
- Captures tribal knowledge
- Reduces repeat questions
- Improves response consistency

### Long-term
- SOPs evolve with business
- New issues documented automatically
- Knowledge gaps identified proactively
- Reduced training time for new staff

## Rollout Plan

### Phase 1: Shadow Mode (Week 1-2)
- Capture knowledge without applying
- Monitor quality of suggestions
- Fine-tune confidence thresholds

### Phase 2: Manual Review (Week 3-4)
- Enable suggestion queue
- Claude reviews all updates
- Track approval rates

### Phase 3: Semi-Automatic (Week 5-6)
- High-confidence updates auto-apply
- Medium confidence to review queue
- Monitor error rates

### Phase 4: Full Automation (Week 7+)
- Automatic learning from all sources
- Real-time SOP updates
- Continuous improvement loop

## Success Metrics

```typescript
// Track improvement over time
const baseline = await getAverageResolutionTime();
const withLearning = await getAverageResolutionTimeAfter(learningStartDate);

const improvement = {
  resolutionTime: `${((baseline - withLearning) / baseline * 100).toFixed(1)}% faster`,
  slackEscalations: `${reductionInSlackQueries}% fewer`,
  sopCoverage: `${newTopicsCovered} new topics documented`,
  employeeSatisfaction: `${satisfactionScore}/5 stars`
};
```

## Future Enhancements

1. **Multi-language SOPs**: Auto-translate based on customer language
2. **Video Integration**: Link to training videos for complex procedures
3. **Predictive Gaps**: Identify issues before they become patterns
4. **Customer Self-Service**: Public SOPs for common issues
5. **API Integration**: Learn from external systems (CRM, billing)

The Learning SOP Module transforms ClubOS from a static knowledge base to a living, breathing system that gets smarter with every interaction.
