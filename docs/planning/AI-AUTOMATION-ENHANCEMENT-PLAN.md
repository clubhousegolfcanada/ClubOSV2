# AI Automation Enhancement Plan

## Goal
Enable AI to actually complete actions and respond to customers automatically, using the knowledge store for instant responses without OpenAI API calls.

## Current State
- AI can suggest responses but doesn't send them
- Pattern matching for gift cards, trackman reset, booking changes
- LLM analysis available but not executing actions
- Knowledge store built but not connected to automations

## Enhancement Implementation

### Phase 1: Add Action Execution Toggles

#### 1.1 Database Schema Update
Create migration `055_ai_automation_actions.sql`:
```sql
-- Add action execution configuration to features
ALTER TABLE ai_automation_features
ADD COLUMN IF NOT EXISTS can_execute_actions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_send_responses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS use_knowledge_store BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_confirmation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}';

-- Track actual actions taken
CREATE TABLE IF NOT EXISTS ai_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES ai_automation_features(id),
  conversation_id VARCHAR(255),
  action_type VARCHAR(50), -- 'send_message', 'reset_trackman', 'unlock_door', etc
  action_details JSONB,
  status VARCHAR(20), -- 'pending', 'completed', 'failed', 'cancelled'
  executed_at TIMESTAMP,
  executed_by VARCHAR(50), -- 'ai_auto', 'user_confirmed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add specific automation features
INSERT INTO ai_automation_features (feature_key, feature_name, description, category, config) VALUES
('auto_respond', 'Automatic Response', 'AI sends responses directly to customers without human review', 'customer_service', 
  '{"maxAutoResponses": 3, "confidenceThreshold": 0.8}'),
('auto_execute', 'Automatic Action Execution', 'AI executes actions like simulator resets automatically', 'technical',
  '{"allowedActions": ["trackman_reset", "projector_control"], "requiresHighConfidence": true}')
ON CONFLICT (feature_key) DO NOTHING;
```

#### 1.2 Enhanced AI Automation Service
Update `aiAutomationService.ts` to:

```typescript
interface AutomationConfig {
  canExecuteActions: boolean;
  canSendResponses: boolean;
  useKnowledgeStore: boolean;
  requireConfirmation: boolean;
  confidenceThreshold: number;
}

async processMessage(phoneNumber: string, message: string, conversationId: string): Promise<AutomationResponse> {
  // 1. Check knowledge store FIRST
  if (await this.shouldUseKnowledgeStore()) {
    const knowledgeResponse = await this.searchKnowledgeStore(message);
    if (knowledgeResponse.confidence > 0.8) {
      // Found high-confidence answer in knowledge store
      if (await this.canAutoRespond()) {
        await this.sendAutomaticResponse(phoneNumber, knowledgeResponse.answer, conversationId);
        return { handled: true, response: knowledgeResponse.answer, source: 'knowledge_store' };
      }
    }
  }
  
  // 2. Check for actionable patterns (gift card, trackman, etc)
  const action = await this.detectActionablePattern(message);
  if (action) {
    if (await this.canExecuteAction(action.type)) {
      await this.executeAction(action);
      return { handled: true, actionExecuted: action.type };
    }
  }
  
  // 3. Fall back to LLM if enabled
  if (await this.shouldUseLLM()) {
    const llmResponse = await this.getLLMResponse(message);
    if (llmResponse.confidence > 0.7 && await this.canAutoRespond()) {
      await this.sendAutomaticResponse(phoneNumber, llmResponse.answer, conversationId);
      return { handled: true, response: llmResponse.answer, source: 'llm' };
    }
  }
  
  return { handled: false };
}

private async executeAction(action: DetectedAction): Promise<void> {
  switch(action.type) {
    case 'trackman_reset':
      if (action.bayNumber) {
        await ninjaoneService.resetTrackman(action.bayNumber);
        await this.logAction('trackman_reset', { bay: action.bayNumber });
      }
      break;
    case 'unlock_door':
      if (action.location) {
        await unifiAccessService.unlockDoor(action.location);
        await this.logAction('unlock_door', { location: action.location });
      }
      break;
    // Add more actions
  }
}
```

### Phase 2: Enhanced UI Controls

#### 2.1 Update AI Feature Card Component
Add new controls to `AIFeatureCard.tsx`:

```tsx
// New configuration options
<div className="space-y-4">
  {/* Auto Response Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <label className="font-medium">Auto-Send Responses</label>
      <p className="text-xs text-muted">AI sends responses without human review</p>
    </div>
    <Toggle 
      checked={feature.can_send_responses}
      onChange={(val) => updateFeature('can_send_responses', val)}
    />
  </div>

  {/* Action Execution Toggle */}
  <div className="flex items-center justify-between">
    <div>
      <label className="font-medium">Execute Actions</label>
      <p className="text-xs text-muted">AI can reset simulators, unlock doors, etc</p>
    </div>
    <Toggle 
      checked={feature.can_execute_actions}
      onChange={(val) => updateFeature('can_execute_actions', val)}
    />
  </div>

  {/* Knowledge Store Usage */}
  <div className="flex items-center justify-between">
    <div>
      <label className="font-medium">Use Knowledge Store First</label>
      <p className="text-xs text-muted">Check local knowledge before using OpenAI</p>
    </div>
    <Toggle 
      checked={feature.use_knowledge_store}
      onChange={(val) => updateFeature('use_knowledge_store', val)}
    />
  </div>

  {/* Confidence Threshold */}
  <div>
    <label className="font-medium">Confidence Threshold</label>
    <input 
      type="range"
      min="0.5"
      max="1.0"
      step="0.1"
      value={feature.config.confidenceThreshold || 0.8}
      onChange={(e) => updateConfig('confidenceThreshold', e.target.value)}
    />
    <span className="text-sm">{feature.config.confidenceThreshold || 0.8}</span>
  </div>

  {/* Action History */}
  <div className="mt-4 p-3 bg-secondary rounded">
    <h4 className="font-medium mb-2">Recent Actions</h4>
    {recentActions.map(action => (
      <div key={action.id} className="text-xs py-1">
        <span className={action.status === 'completed' ? 'text-green-600' : 'text-red-600'}>
          {action.action_type}
        </span>
        <span className="ml-2 text-muted">
          {new Date(action.executed_at).toLocaleString()}
        </span>
      </div>
    ))}
  </div>
</div>
```

### Phase 3: Knowledge Store Integration

#### 3.1 Connect Knowledge Store to AI Automations
Update `unifiedKnowledgeSearch.ts`:

```typescript
export async function searchForAutomation(query: string): Promise<KnowledgeResult> {
  // 1. Search knowledge_store table FIRST
  const storeResult = await knowledgeStore.search(query, {
    minConfidence: 0.5,
    includePatterns: true
  });
  
  if (storeResult.found && storeResult.confidence > 0.8) {
    return {
      found: true,
      answer: storeResult.value,
      confidence: storeResult.confidence,
      source: 'knowledge_store',
      canAutoRespond: true
    };
  }
  
  // 2. Search knowledge patterns for learned responses
  const patternResult = await searchPatterns(query);
  if (patternResult.found) {
    return {
      found: true,
      answer: patternResult.solution,
      confidence: patternResult.confidence,
      source: 'patterns',
      canAutoRespond: patternResult.confidence > 0.9
    };
  }
  
  // 3. Only use OpenAI if local search fails
  return { found: false };
}
```

### Phase 4: Learning from Responses

#### 4.1 Automatic Pattern Learning
When support responds to a customer:

```typescript
async function learnFromResponse(
  customerMessage: string,
  supportResponse: string,
  wasSuccessful: boolean
) {
  // Extract key-value from conversation
  const extracted = await extractKnowledge(customerMessage, supportResponse);
  
  if (extracted && wasSuccessful) {
    // Add to knowledge store
    await knowledgeStore.set(extracted.key, extracted.value, {
      source: 'learned_from_conversation',
      confidence: 0.7,
      metadata: {
        original_question: customerMessage,
        successful_response: supportResponse
      }
    });
    
    // Update patterns
    await updatePattern(customerMessage, supportResponse, wasSuccessful);
  }
}
```

## Implementation Order

1. **Fix deployment error** ✅
2. **Create database migration** for new action fields
3. **Update backend service** to handle auto-execution
4. **Enhance UI** with new toggles and controls
5. **Connect knowledge store** to automation service
6. **Test with safe actions** (gift cards)
7. **Enable dangerous actions** with confirmation (trackman reset)
8. **Add learning loop** from conversations

## Safety Features

- Confidence thresholds per action type
- Max auto-responses per conversation
- Require confirmation for destructive actions
- Audit log of all automatic actions
- Emergency stop button to disable all automations
- Role-based permissions for enabling features

## Expected Outcome

- **Instant responses** for common questions using knowledge store
- **Automatic action execution** for safe operations
- **Reduced API costs** by using local knowledge first
- **Learning system** that improves over time
- **Full automation** for 70%+ of customer inquiries