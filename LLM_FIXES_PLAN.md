# ClubOS LLM System Fixes Implementation Plan

## Critical Issues Identified

### 1. Missing Context/Memory System
**Problem**: Each LLM request is processed in isolation without conversation history or context.

**Fix**: Implement context retrieval and injection system
- Fetch last 5 interactions from `customer_interactions` table
- Inject relevant past issues and resolutions into prompt
- Track session continuity for multi-turn conversations

### 2. Route Naming Inconsistencies
**Problem**: Frontend sends "Booking&Access" but backend expects "Booking & Access"

**Fix**: Standardize route names across system
- Update route mapping in assistant service
- Add normalization function for route names
- Update validation to handle both formats

### 3. Knowledge Base Migration Incomplete
**Problem**: System still tries to load JSON knowledge files that were removed

**Fix**: Migrate knowledge to PostgreSQL
- Create `knowledge_base` table structure
- Import existing knowledge into database
- Update KnowledgeLoader to use database instead of files

### 4. Prompt Engineering Issues
**Problem**: Generic prompts lack facility context and structured response format

**Fix**: Enhanced prompt templates with:
- Facility-specific information injection
- User role and permission context
- Clear structured JSON response format
- Examples of good responses

### 5. Slack Integration Limitations
**Problem**: Webhook-only integration can't retrieve responses or track threads

**Fix**: Enhanced Slack tracking
- Store all Slack thread IDs in database
- Create endpoint for manual response injection
- Track resolution status and feedback

## Implementation Steps

### Step 1: Fix Route Naming (Immediate)
```typescript
// Add route normalization function
function normalizeRoute(route: string): string {
  const routeMap: Record<string, string> = {
    'Booking&Access': 'Booking & Access',
    'booking': 'Booking & Access',
    'access': 'Booking & Access',
    'emergency': 'Emergency',
    'tech': 'TechSupport',
    'brand': 'BrandTone'
  };
  return routeMap[route] || route;
}
```

### Step 2: Implement Context Injection
```typescript
// Fetch recent interactions for context
async function getUserContext(userId: string, limit = 5): Promise<string> {
  const interactions = await db.query(
    `SELECT request_text, response_text, route, confidence, created_at 
     FROM customer_interactions 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [userId, limit]
  );
  
  if (interactions.rows.length === 0) return '';
  
  return `Previous interactions:\n${interactions.rows.map(i => 
    `- Request: ${i.request_text}\n  Response: ${i.response_text}\n  Route: ${i.route}`
  ).join('\n')}`;
}
```

### Step 3: Enhanced System Prompt
```typescript
function getEnhancedSystemPrompt(context?: string): string {
  return `You are ClubOSV1, an intelligent assistant for Clubhouse 24/7 Golf simulator facility.

FACILITY INFORMATION:
- Location: Golf simulator facility with multiple bays
- Services: Golf simulation (TrackMan), bookings, memberships
- Hours: 24/7 operation
- Support: On-site staff during business hours, emergency support available

AVAILABLE ROUTES:
- Booking & Access: Reservations, cancellations, door access, key cards, refunds
- Emergency: Safety issues, injuries, fire, medical emergencies, power outages
- TechSupport: TrackMan issues, screen problems, software errors, equipment malfunctions
- BrandTone: Membership info, pricing, promotions, general facility information

${context ? `\nCONTEXT FROM PREVIOUS INTERACTIONS:\n${context}\n` : ''}

RESPONSE FORMAT:
You must respond in valid JSON with this structure:
{
  "route": "selected_route",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "response": "human-friendly response text",
  "extractedInfo": {
    "key_details": "extracted from request"
  },
  "suggestedActions": ["action1", "action2"],
  "requiresHumanReview": boolean
}

IMPORTANT RULES:
1. Always provide helpful, specific responses
2. Include phone numbers for emergencies (911 for life-threatening, facility: 555-0100)
3. For technical issues, suggest basic troubleshooting first
4. Mark complex or unusual requests for human review`;
}
```

### Step 4: Database Schema for Knowledge Base
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  issue VARCHAR(255) NOT NULL,
  symptoms TEXT[],
  solutions TEXT[],
  priority VARCHAR(20),
  time_estimate VARCHAR(50),
  customer_script TEXT,
  escalation_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_symptoms ON knowledge_base USING GIN(symptoms);
CREATE INDEX idx_knowledge_category ON knowledge_base(category);
```

### Step 5: Session Tracking
```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES "Users"(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  context JSONB,
  active BOOLEAN DEFAULT true
);

CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_active ON conversation_sessions(active);
```

## Priority Order

1. **Immediate** (Day 1):
   - Fix route naming mismatches
   - Add basic context injection
   - Enhanced error logging

2. **High Priority** (Day 2-3):
   - Implement session tracking
   - Migrate knowledge base to PostgreSQL
   - Enhanced prompt templates

3. **Medium Priority** (Day 4-5):
   - Slack thread tracking improvements
   - Feedback loop implementation
   - Performance monitoring

## Success Metrics

- LLM response success rate > 85%
- Average confidence score > 0.7
- Slack escalation rate < 20%
- User satisfaction (useful feedback) > 80%