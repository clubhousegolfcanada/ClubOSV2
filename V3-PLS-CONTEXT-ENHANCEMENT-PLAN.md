# V3-PLS Context-Aware Multi-Turn Conversation Enhancement Plan

## Overview
Enhance V3-PLS to understand full conversation context, learn from complete message threads, and handle multi-turn interactions with automated follow-ups and escalation logic.

## Key Features

### 1. Full Conversation Context Analysis
- **GPT-4o Context Processing**: Analyze entire conversation threads, not just individual messages
- **Pattern Extraction**: Identify patterns from complete customer-operator interactions
- **Smart Learning**: Store successful resolution patterns with full context
- **Default Off**: New patterns are disabled by default until operator review

### 2. Multi-Turn Conversation Support
- **Conversation State Tracking**: Track where each conversation is in the flow
- **Follow-Up Actions**: Automated follow-ups based on customer responses
- **Response Limit**: Maximum 3 automated responses before escalation
- **Context Memory**: Remember previous messages in the conversation

### 3. Example Flow: TrackMan Reset
```
Customer: "My TrackMan isn't working"
AI: "I can help with that. Would you like me to restart your TrackMan remotely?"
Customer: "Yes please"
AI: "Okay, completing that now. Please wait 2-3 minutes for it to restart, then let me know if it's working."
[System executes remote reset via NinjaOne]
Customer: "It's working now, thanks!"
AI: "Great! Glad I could help. Enjoy your session!"

OR

Customer: "It's still not working"
AI: [Escalates to operator] "I've tried a remote reset but the issue persists. Let me connect you with our support team for further assistance."
```

## Database Schema Updates

### 1. Enhanced Pattern Table
```sql
ALTER TABLE decision_patterns ADD COLUMN IF NOT EXISTS
  conversation_context JSONB DEFAULT '{}',
  multi_turn_enabled BOOLEAN DEFAULT FALSE,
  max_turns INTEGER DEFAULT 3,
  escalation_triggers TEXT[],
  follow_up_templates JSONB DEFAULT '[]',
  requires_action BOOLEAN DEFAULT FALSE,
  action_type VARCHAR(50),
  action_config JSONB DEFAULT '{}';
```

### 2. Conversation State Tracking
```sql
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  pattern_id INTEGER REFERENCES decision_patterns(id),
  current_turn INTEGER DEFAULT 1,
  state VARCHAR(50) DEFAULT 'active',
  context JSONB DEFAULT '{}',
  last_ai_action VARCHAR(255),
  awaiting_response BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Pattern Learning Queue
```sql
CREATE TABLE pattern_learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR(255) NOT NULL,
  full_conversation JSONB NOT NULL,
  extracted_pattern JSONB,
  gpt4_analysis TEXT,
  confidence_score FLOAT,
  operator_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

## Implementation Steps

### Phase 1: Context Analysis Engine
```typescript
// services/patternContextAnalyzer.ts
interface ConversationAnalysis {
  intent: string;
  resolution: string;
  turns: number;
  actions_taken: string[];
  customer_sentiment: 'positive' | 'negative' | 'neutral';
  follow_up_needed: boolean;
  pattern_signature: string;
}

async function analyzeConversationContext(messages: Message[]): Promise<ConversationAnalysis> {
  const prompt = `
    Analyze this customer service conversation and extract:
    1. Primary customer intent
    2. Resolution provided
    3. Actions taken
    4. Customer sentiment
    5. Whether follow-up is needed
    6. A reusable pattern for similar situations
    
    Conversation:
    ${messages.map(m => `${m.direction}: ${m.text}`).join('\n')}
  `;
  
  const analysis = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.3
  });
  
  return JSON.parse(analysis.choices[0].message.content);
}
```

### Phase 2: Multi-Turn Flow Manager
```typescript
// services/conversationFlowManager.ts
class ConversationFlowManager {
  async processMessage(conversationId: string, message: string): Promise<AIResponse> {
    // Get conversation state
    const state = await getConversationState(conversationId);
    
    // Check if we're in a multi-turn flow
    if (state?.awaiting_response) {
      return this.handleFollowUp(state, message);
    }
    
    // Start new flow if pattern matches
    const pattern = await findMatchingPattern(message);
    if (pattern?.multi_turn_enabled) {
      return this.startMultiTurnFlow(conversationId, pattern, message);
    }
    
    // Single response flow
    return this.generateSingleResponse(message);
  }
  
  async handleFollowUp(state: ConversationState, message: string): Promise<AIResponse> {
    // Check turn limit
    if (state.current_turn >= state.max_turns) {
      return this.escalateToOperator(state, 'Turn limit reached');
    }
    
    // Check for negative response
    if (this.isNegativeResponse(message)) {
      return this.escalateToOperator(state, 'Customer reported issue not resolved');
    }
    
    // Continue flow
    return this.continueFlow(state, message);
  }
  
  private isNegativeResponse(message: string): boolean {
    const negativeIndicators = [
      'not working', 'still broken', 'didn\'t help', 
      'no', 'nope', 'still having', 'worse'
    ];
    return negativeIndicators.some(indicator => 
      message.toLowerCase().includes(indicator)
    );
  }
}
```

### Phase 3: Action Execution System
```typescript
// services/actionExecutor.ts
interface ActionConfig {
  type: 'ninjaone_reset' | 'door_unlock' | 'send_link' | 'create_ticket';
  params: Record<string, any>;
}

class ActionExecutor {
  async executeAction(action: ActionConfig): Promise<boolean> {
    switch (action.type) {
      case 'ninjaone_reset':
        return await this.executeNinjaOneReset(action.params);
      case 'door_unlock':
        return await this.unlockDoor(action.params);
      case 'send_link':
        return await this.sendLink(action.params);
      case 'create_ticket':
        return await this.createTicket(action.params);
      default:
        return false;
    }
  }
  
  private async executeNinjaOneReset(params: any): Promise<boolean> {
    // Execute TrackMan reset via NinjaOne
    const response = await apiClient.post('/ninjaone-remote/execute', {
      scriptId: params.scriptId,
      deviceId: params.deviceId
    });
    return response.success;
  }
}
```

### Phase 4: Operator Approval Interface
```tsx
// components/PatternApprovalQueue.tsx
export const PatternApprovalQueue: React.FC = () => {
  const [queue, setQueue] = useState<PatternLearningItem[]>([]);
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Pattern Learning Queue</h2>
      
      {queue.map(item => (
        <div key={item.id} className="border rounded-lg p-4">
          <div className="mb-3">
            <h3 className="font-semibold">Extracted Pattern</h3>
            <p className="text-sm text-gray-600">{item.pattern_signature}</p>
          </div>
          
          <div className="mb-3">
            <h4 className="font-medium">Conversation Context</h4>
            <div className="bg-gray-50 p-2 rounded text-sm">
              {item.conversation.map(msg => (
                <div key={msg.id}>
                  <span className="font-medium">{msg.direction}:</span> {msg.text}
                </div>
              ))}
            </div>
          </div>
          
          <div className="mb-3">
            <h4 className="font-medium">Suggested Response Template</h4>
            <textarea
              className="w-full p-2 border rounded"
              defaultValue={item.response_template}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => approvePattern(item.id)}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Approve & Enable
            </button>
            <button
              onClick={() => approveDisabled(item.id)}
              className="px-4 py-2 bg-yellow-600 text-white rounded"
            >
              Approve (Keep Disabled)
            </button>
            <button
              onClick={() => rejectPattern(item.id)}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## API Endpoints

### 1. Pattern Learning
```typescript
// POST /api/patterns/learn-from-conversation
{
  conversation_id: string;
  messages: Message[];
  resolution: string;
  operator_notes?: string;
}

// Response
{
  pattern_id: number;
  confidence: number;
  requires_approval: boolean;
}
```

### 2. Multi-Turn Management
```typescript
// POST /api/patterns/process-message
{
  conversation_id: string;
  message: string;
  customer_id: string;
}

// Response
{
  response: string;
  action_taken?: string;
  awaiting_response: boolean;
  turn_number: number;
  should_escalate: boolean;
}
```

### 3. Pattern Approval
```typescript
// GET /api/patterns/approval-queue

// PUT /api/patterns/:id/approve
{
  enabled: boolean;
  response_template?: string;
  multi_turn_config?: MultiTurnConfig;
}
```

## Benefits

1. **Contextual Understanding**: AI understands full conversation context, not just single messages
2. **Automated Follow-ups**: Handle multi-turn interactions without operator intervention
3. **Smart Escalation**: Automatically escalate when issues aren't resolved
4. **Learning from Success**: Capture successful resolution patterns for reuse
5. **Operator Control**: All new patterns default to disabled until reviewed
6. **Action Integration**: Execute remote actions (resets, unlocks) as part of flow

## Success Metrics

- **Automation Rate**: Target 80% of common issues handled automatically
- **Resolution Rate**: Track successful resolutions without escalation
- **Turn Efficiency**: Average turns to resolution (target: <3)
- **Pattern Accuracy**: Operator approval rate for learned patterns
- **Customer Satisfaction**: Positive response rate to automated interactions

## Next Steps

1. Implement database schema updates
2. Build GPT-4o context analyzer service
3. Create multi-turn conversation manager
4. Integrate action execution system
5. Build operator approval UI
6. Test with real conversation data
7. Deploy to production with monitoring