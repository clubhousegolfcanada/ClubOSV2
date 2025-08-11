# Conversation to Knowledge Pipeline

## Existing System (Already Working)
- ✅ Groups messages within 1-hour windows
- ✅ Creates new conversation after 1-hour gap
- ✅ Prevents old context from mixing with new topics

## Enhanced Knowledge Extraction Flow

### 1. When Conversation Ends (1+ hour gap detected)

```javascript
async function onConversationComplete(conversation) {
  // Conversation is complete when:
  // - 1 hour has passed since last message
  // - OR conversation manually marked as resolved
  
  const analysis = await analyzeConversation(conversation);
  
  if (analysis.hasValueableKnowledge) {
    await extractAndStoreKnowledge(analysis);
  }
}
```

### 2. Smart Analysis Pipeline

```javascript
async function analyzeConversation(conversation) {
  // Step 1: Identify conversation type
  const type = identifyType(conversation);
  // Types: 'problem_solved', 'question_answered', 'booking_made', 'complaint', 'general_chat'
  
  // Step 2: Extract key information
  if (type === 'problem_solved') {
    return {
      hasValueableKnowledge: true,
      problem: extractProblem(conversation),
      solution: extractSolution(conversation),
      confidence: calculateConfidence(conversation),
      category: detectCategory(conversation)
    };
  }
  
  if (type === 'question_answered') {
    return {
      hasValueableKnowledge: true,
      question: extractQuestion(conversation),
      answer: extractAnswer(conversation),
      confidence: calculateConfidence(conversation)
    };
  }
  
  // General chat or complaints might not have valuable knowledge
  if (type === 'general_chat' || type === 'complaint') {
    return {
      hasValueableKnowledge: false,
      reason: 'No actionable knowledge found'
    };
  }
}
```

### 3. Knowledge Extraction Rules

```javascript
const EXTRACTION_RULES = {
  // Only extract if conversation had a clear resolution
  requiresResolution: true,
  
  // Minimum messages to consider extraction
  minimumMessages: 3,
  
  // Skip if conversation was just scheduling/booking
  skipBookingOnly: true,
  
  // Patterns that indicate valuable knowledge
  valuablePatterns: [
    /how (do|can|to)/i,           // How-to questions
    /what (is|are|should)/i,      // Information requests
    /problem|issue|broken|frozen/i, // Problems
    /fixed|solved|worked/i,        // Solutions
    /try|press|click|go to/i      // Instructions
  ],
  
  // Patterns to skip
  skipPatterns: [
    /thank you|thanks/i,           // Just gratitude
    /ok|okay|sure|yes|no/i,       // Simple acknowledgments
    /see you|bye|goodbye/i        // Sign-offs
  ]
};
```

### 4. Deduplication Before Storage

```javascript
async function extractAndStoreKnowledge(analysis) {
  // Check if we already have this knowledge
  const existing = await findSimilarKnowledge(analysis.problem);
  
  if (existing) {
    // Update occurrence count
    await db.query(`
      UPDATE knowledge_patterns 
      SET occurrence_count = occurrence_count + 1,
          last_seen = NOW()
      WHERE id = $1
    `, [existing.id]);
    
    // If this solution is different/better, update
    if (analysis.confidence > existing.confidence) {
      await updateKnowledgePattern(existing.id, {
        current_best_solution: analysis.solution,
        current_best_confidence: analysis.confidence
      });
    } else {
      // Just add to alternatives
      await addAlternativeSolution(existing.id, analysis.solution);
    }
  } else {
    // New knowledge - store it
    await createKnowledgeEntry({
      key: generateKey(analysis),
      value: {
        problem: analysis.problem,
        solution: analysis.solution,
        examples: [conversation.messages],
        source: 'conversation',
        conversation_id: conversation.id
      },
      confidence: analysis.confidence,
      verification_status: 'learned'
    });
  }
}
```

## Examples of What Gets Extracted

### Example 1: Trackman Reset (Valuable)
```
Customer: "Trackman in bay 2 is frozen"
Support: "Try pressing Windows key, type cmd, then run trackman-reset.bat"
Customer: "That worked, thanks!"

EXTRACTED:
- Problem: "Trackman frozen"
- Solution: "Press Windows key, type cmd, run trackman-reset.bat"
- Confidence: 0.9 (solution confirmed working)
- Category: "technical"
```

### Example 2: Gift Card Purchase (Valuable)
```
Customer: "How do I buy a gift card?"
Support: "You can purchase gift cards at clubhouse247golf.com/giftcard"
Customer: "Perfect, just bought one"

EXTRACTED:
- Question: "How to buy gift card"
- Answer: "https://clubhouse247golf.com/giftcard"
- Confidence: 1.0 (customer confirmed)
- Category: "sales"
```

### Example 3: Just Booking (Not Extracted)
```
Customer: "Can I book bay 3 for 7pm?"
Support: "Yes, it's available. Booked for you."
Customer: "Thanks"

NOT EXTRACTED: Simple booking, no reusable knowledge
```

### Example 4: Complaint (Not Extracted)
```
Customer: "The music was too loud last night"
Support: "Sorry about that, we'll keep it lower"
Customer: "Ok thanks"

NOT EXTRACTED: One-time issue, not reusable
```

## Conversation Lifecycle

```
New Message Arrives
        ↓
Check Last Message Time
        ↓
    ┌───┴───┐
    │ < 1hr │ → Add to Existing Conversation
    └───────┘
        ↓
    ┌───┴────┐
    │ > 1hr  │ → End Previous Conversation
    └────────┘         ↓
                  Extract Knowledge
                        ↓
                  Check If Valuable
                        ↓
                    ┌───┴───┐
                    │  Yes  │ → Store/Update Knowledge
                    └───────┘
                        ↓
                    ┌───┴───┐
                    │  No   │ → Archive Conversation Only
                    └───────┘
```

## Database Schema for Conversation Tracking

```sql
-- Already exists: openphone_conversations table
-- Groups messages within 1-hour windows

-- Add knowledge extraction tracking
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS knowledge_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extraction_result JSONB,
ADD COLUMN IF NOT EXISTS knowledge_id UUID REFERENCES knowledge_store(id);

-- Track extraction attempts
CREATE TABLE IF NOT EXISTS knowledge_extraction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255),
  extracted_at TIMESTAMP DEFAULT NOW(),
  
  -- What was found
  extraction_type VARCHAR(50), -- 'problem_solved', 'question_answered', etc
  extracted_data JSONB,
  confidence FLOAT,
  
  -- What happened with it
  action_taken VARCHAR(50), -- 'created_new', 'updated_existing', 'skipped_duplicate'
  knowledge_id UUID REFERENCES knowledge_store(id),
  
  -- Why it was/wasn't extracted
  skip_reason TEXT
);
```

## Automatic Processing

### Real-time Processing
```javascript
// When new message creates new conversation (1hr+ gap)
webhookHandler.on('newConversation', async (prevConversation) => {
  if (prevConversation) {
    await processCompletedConversation(prevConversation);
  }
});
```

### Batch Processing (Daily)
```javascript
// Process any conversations not yet analyzed
async function dailyKnowledgeExtraction() {
  const unprocessed = await db.query(`
    SELECT * FROM openphone_conversations
    WHERE knowledge_extracted = false
    AND updated_at < NOW() - INTERVAL '1 hour'
    AND jsonb_array_length(messages) >= 3
    LIMIT 100
  `);
  
  for (const conversation of unprocessed.rows) {
    await analyzeAndExtract(conversation);
  }
}
```

## Benefits

1. **Automatic**: Extracts knowledge when conversations end
2. **Smart**: Only extracts valuable, reusable information
3. **No Duplicates**: Updates existing knowledge instead of creating copies
4. **Clean Context**: 1-hour window prevents topic mixing
5. **Trackable**: See which conversations generated which knowledge

This leverages your existing conversation grouping to intelligently extract knowledge without manual intervention!