# V3-PLS Unified Implementation Plan - AI Automations UI
*Date: September 6, 2025*

## 🎯 Vision
Transform learned patterns into toggleable "AI Automations" that operators can control, while integrating the accept/modify/reject flow directly into the Messages page where operators work.

## 🏗️ Architecture Overview

### 1. Pattern Learning → AI Automation Features
Each learned pattern becomes an AI Automation card that can be toggled on/off:

```
Customer: "Do you sell gift cards?"
Operator: "Yes! Purchase at www.clubhouse247golf.com/giftcard/purchase"
           ↓
System learns pattern
           ↓
Creates "Gift Card Inquiries" automation
           ↓
Shows as toggleable card in AI Automations
```

### 2. Two-Interface Design

**Messages Page (Where operators work):**
- See customer messages
- AI suggests responses inline
- Accept/Modify/Reject buttons right there
- Learning happens transparently

**V3-PLS Page (Management & editing):**
- AI Automations cards (on/off toggles)
- Edit response templates
- View statistics
- Adjust confidence thresholds

## 📐 Detailed Implementation Plan

### Phase 1: Database Structure Enhancement

#### 1.1 Link Patterns to AI Automation Features
```sql
-- Add automation feature fields to patterns
ALTER TABLE decision_patterns 
ADD COLUMN automation_feature_key VARCHAR(100),
ADD COLUMN automation_name VARCHAR(255),
ADD COLUMN automation_description TEXT,
ADD COLUMN automation_category VARCHAR(50) DEFAULT 'customer service',
ADD COLUMN automation_enabled BOOLEAN DEFAULT false,
ADD COLUMN min_confidence_for_auto_enable FLOAT DEFAULT 0.85;

-- Create index for quick lookup
CREATE INDEX idx_patterns_automation_key ON decision_patterns(automation_feature_key);

-- Example: Link gift card pattern to feature
UPDATE decision_patterns 
SET 
  automation_feature_key = 'gift_card_auto_response',
  automation_name = 'Gift Card Inquiries',
  automation_description = 'Automatically respond to gift card purchase questions with link to purchase page',
  automation_category = 'customer service'
WHERE pattern_type = 'gift_cards';
```

### Phase 2: Messages Page Integration

#### 2.1 Inline AI Suggestions
```typescript
// MessagesWindow.tsx - Add AI suggestion UI
interface AIResponseSuggestion {
  patternId: number;
  suggestedResponse: string;
  confidence: number;
  automationName: string;
  isAutoEnabled: boolean;
}

const MessageComposer = () => {
  const [aiSuggestion, setAiSuggestion] = useState<AIResponseSuggestion | null>(null);
  
  return (
    <div className="message-composer">
      {aiSuggestion && (
        <div className="ai-suggestion-card bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {aiSuggestion.automationName} ({Math.round(aiSuggestion.confidence * 100)}% confident)
              </span>
            </div>
            {aiSuggestion.isAutoEnabled && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                Auto-sending in 5s...
              </span>
            )}
          </div>
          
          <div className="bg-white rounded p-3 mb-3">
            <p className="text-gray-800">{aiSuggestion.suggestedResponse}</p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => acceptSuggestion(aiSuggestion)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Send
            </button>
            
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Edit className="h-4 w-4" />
              Modify
            </button>
            
            <button
              onClick={() => rejectSuggestion(aiSuggestion)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            
            <button
              onClick={() => alwaysUseThis(aiSuggestion)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 ml-auto"
            >
              <Zap className="h-4 w-4" />
              Always use this
            </button>
          </div>
        </div>
      )}
      
      {/* Regular message input */}
      <textarea 
        className="message-input"
        placeholder={aiSuggestion ? "Or type your own response..." : "Type a message..."}
      />
    </div>
  );
};
```

#### 2.2 Learning from Operator Actions
```typescript
// When operator sends a message
async function handleSendMessage(message: string, aiSuggestion?: AIResponseSuggestion) {
  // If they accepted AI suggestion
  if (aiSuggestion && message === aiSuggestion.suggestedResponse) {
    await updatePatternConfidence(aiSuggestion.patternId, 'accepted');
  }
  
  // If they modified AI suggestion
  else if (aiSuggestion && message.includes(aiSuggestion.suggestedResponse.substring(0, 20))) {
    await updatePatternConfidence(aiSuggestion.patternId, 'modified');
    await learnFromModification(aiSuggestion.patternId, message);
  }
  
  // If they rejected and wrote their own
  else if (aiSuggestion) {
    await updatePatternConfidence(aiSuggestion.patternId, 'rejected');
    await learnNewPattern(customerMessage, message);
  }
  
  // No suggestion existed - learn this as new pattern
  else {
    await learnNewPattern(customerMessage, message);
  }
}
```

### Phase 3: V3-PLS Page - AI Automations UI

#### 3.1 Transform Patterns into Automation Cards
```typescript
// OperationsPatternsEnhanced.tsx - New AI Automations view
const AIAutomationsView = () => {
  const [automations, setAutomations] = useState<PatternAutomation[]>([]);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          AI Automations 
          <span className="text-sm text-gray-500">
            ({automations.filter(a => a.enabled).length}/{automations.length} active)
          </span>
        </h2>
      </div>
      
      {/* Group by category */}
      {Object.entries(groupBy(automations, 'category')).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">
            {category}
          </h3>
          
          <div className="space-y-3">
            {items.map(automation => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={toggleAutomation}
                onEdit={editAutomation}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Individual Automation Card Component
const AutomationCard = ({ automation, onToggle, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900">
              {automation.name}
            </h3>
            {automation.confidence >= 0.85 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                RECOMMENDED
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-3">
            {automation.description}
          </p>
          
          {automation.enabled && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>✨ Used {automation.executionCount} times</span>
              <span>📊 {automation.successRate}% success rate</span>
              <span>🕐 Last used {formatTimeAgo(automation.lastUsed)}</span>
            </div>
          )}
          
          {expanded && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium mb-2">Response Template:</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {automation.responseTemplate}
              </p>
              
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onEdit(automation)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Edit Response
                </button>
                <button
                  onClick={() => viewHistory(automation)}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  View History
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            <Settings className="h-4 w-4" />
          </button>
          
          <Switch
            checked={automation.enabled}
            onCheckedChange={(checked) => onToggle(automation.id, checked)}
            className={automation.enabled ? 'bg-green-600' : 'bg-gray-300'}
          />
        </div>
      </div>
      
      {automation.category && (
        <div className="mt-3">
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {automation.category}
          </span>
        </div>
      )}
    </div>
  );
};
```

### Phase 4: Auto-Learning & Pattern Creation

#### 4.1 Automatic Pattern Creation from Operator Messages
```typescript
// patternLearningService.ts enhancements
async function learnFromOperatorResponse(
  customerMessage: string,
  operatorResponse: string,
  context: MessageContext
): Promise<void> {
  // Use GPT-4o to analyze the Q&A pair
  const analysis = await analyzeInteraction({
    customer: customerMessage,
    operator: operatorResponse,
    context
  });
  
  // Check if similar pattern exists
  const existingPattern = await findSimilarPattern(analysis.signature);
  
  if (existingPattern) {
    // Strengthen existing pattern
    await reinforcePattern(existingPattern.id, operatorResponse);
  } else {
    // Create new pattern
    const pattern = await createPattern({
      type: analysis.type,
      name: analysis.suggestedName, // "Gift Card Inquiries"
      description: analysis.suggestedDescription,
      triggerText: customerMessage,
      responseTemplate: extractTemplate(operatorResponse),
      keywords: analysis.keywords,
      confidence: 0.60, // Start moderate
      category: analysis.category,
      automationKey: generateAutomationKey(analysis.type)
    });
    
    // Generate embedding for semantic matching
    await generateAndStoreEmbedding(pattern.id, customerMessage);
  }
}

// GPT-4o Analysis for smart pattern creation
async function analyzeInteraction({ customer, operator, context }) {
  const prompt = `
    Analyze this customer service interaction and create an automation pattern:
    
    Customer: "${customer}"
    Operator: "${operator}"
    
    Extract:
    1. Pattern type (gift_cards, hours, booking, tech_support, etc)
    2. Automation name (human-friendly like "Gift Card Inquiries")
    3. Description (one line explaining what it does)
    4. Keywords that would trigger this
    5. Category (customer service, technical, booking, etc)
    6. Any URLs, phone numbers, or specific data to preserve
    
    Return as JSON.
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

#### 4.2 Confidence Evolution & Auto-Enable
```typescript
// Pattern confidence management
class PatternConfidenceManager {
  // Thresholds for automation lifecycle
  private readonly THRESHOLDS = {
    CREATE: 0.60,      // Initial confidence for new patterns
    SUGGEST: 0.70,     // Start suggesting to operators
    AUTO_ENABLE: 0.85, // Auto-enable the automation
    FULLY_AUTO: 0.95   // Send without delay
  };
  
  async updateConfidence(patternId: number, action: 'accepted' | 'modified' | 'rejected') {
    const pattern = await getPattern(patternId);
    let newConfidence = pattern.confidence;
    
    switch(action) {
      case 'accepted':
        newConfidence = Math.min(1.0, newConfidence + 0.05);
        break;
      case 'modified':
        newConfidence = Math.min(1.0, newConfidence + 0.02);
        break;
      case 'rejected':
        newConfidence = Math.max(0.3, newConfidence - 0.10);
        break;
    }
    
    // Auto-enable if confidence is high enough
    if (newConfidence >= this.THRESHOLDS.AUTO_ENABLE && !pattern.automation_enabled) {
      await this.enableAutomation(patternId);
      await this.notifyOperators(`New automation enabled: ${pattern.automation_name}`);
    }
    
    // Disable if confidence drops too low
    if (newConfidence < this.THRESHOLDS.SUGGEST && pattern.automation_enabled) {
      await this.disableAutomation(patternId);
      await this.notifyOperators(`Automation disabled due to low confidence: ${pattern.automation_name}`);
    }
    
    await updatePatternConfidence(patternId, newConfidence);
  }
}
```

### Phase 5: Example User Flows

#### Flow 1: Learning Gift Card Response
1. **Customer:** "Do you sell gift cards?"
2. **System:** No pattern found, shows message to operator
3. **Operator types:** "Yes! We offer gift cards at www.clubhouse247golf.com/giftcard/purchase"
4. **System learns:**
   - Creates "Gift Card Inquiries" pattern
   - Extracts URL
   - Sets confidence to 60%
   - Shows as disabled automation in V3-PLS page

#### Flow 2: Pattern Improvement
1. **Customer:** "Can I buy a gift certificate?"
2. **System:** Finds 85% match to gift card pattern, suggests response
3. **Operator:** Clicks "Accept" 
4. **System:**
   - Increases confidence to 65%
   - After 5 more accepts → 85% confidence
   - Auto-enables the automation
   - Shows as active in AI Automations

#### Flow 3: Editing Automation
1. **Operator** goes to V3-PLS page
2. Sees "Gift Card Inquiries" automation is active
3. Clicks settings icon to expand
4. Edits template to add: "They never expire!"
5. Changes saved, pattern continues working

### Phase 6: Implementation Timeline

#### Week 1: Foundation
- [ ] Update database schema with automation fields
- [ ] Create pattern → automation mapping logic
- [ ] Build GPT-4o analysis for pattern creation

#### Week 2: Messages Integration
- [ ] Add AI suggestion UI to Messages page
- [ ] Implement accept/modify/reject handlers
- [ ] Connect learning service to operator responses

#### Week 3: V3-PLS UI
- [ ] Build AI Automations card view
- [ ] Create edit modal for response templates
- [ ] Add statistics and history views

#### Week 4: Testing & Refinement
- [ ] Test with real operator messages
- [ ] Tune confidence thresholds
- [ ] Add analytics tracking

## 🎯 Success Metrics

### Week 1:
- 10+ patterns learned from operator responses
- AI suggestions appearing in Messages page

### Week 2:
- 50+ patterns created
- 30% of messages getting AI suggestions
- 5+ automations auto-enabled

### Month 1:
- 100+ active automations
- 60% automation rate
- Operators report significant time savings

## 💡 Key Features

1. **Seamless Learning** - System learns from normal operator workflow
2. **In-Context Suggestions** - AI helps right in Messages page
3. **Visual Management** - Beautiful automation cards like existing UI
4. **Confidence-Based Evolution** - Patterns improve and auto-enable
5. **Full Control** - Operators can always override or disable

## 🔧 Technical Requirements

### Backend:
- GPT-4o API for pattern analysis
- OpenAI embeddings for semantic matching
- PostgreSQL with pattern tables
- Confidence tracking system

### Frontend:
- AI suggestion component in Messages
- Automation cards in V3-PLS page
- Real-time updates via polling/websockets
- Statistics and analytics views

## 📝 Configuration

### Initial Settings:
```typescript
const V3_PLS_CONFIG = {
  // Learning
  minOccurrencesToLearn: 1,      // Learn from first occurrence
  initialConfidence: 0.60,        // Start at 60%
  
  // Thresholds
  suggestThreshold: 0.70,         // Show suggestions at 70%
  autoEnableThreshold: 0.85,      // Auto-enable at 85%
  instantSendThreshold: 0.95,     // Send without delay at 95%
  
  // Confidence changes
  acceptBoost: 0.05,              // +5% for accept
  modifyBoost: 0.02,              // +2% for modify  
  rejectPenalty: 0.10,            // -10% for reject
  
  // Auto-enable
  minExecutionsForAutoEnable: 10, // Need 10 successful uses
  successRateForAutoEnable: 0.80  // Need 80% success rate
};
```

## Summary

This plan unifies V3-PLS pattern learning with the familiar AI Automations UI. Operators work normally in Messages, where AI suggestions appear inline with accept/modify/reject buttons. Learned patterns become toggleable automations in the V3-PLS page. The system learns automatically, improves with use, and gives operators full control.

**The result:** Never type the same response twice, with a beautiful UI that matches the existing ClubOS design.

---
*End of Implementation Plan*