# Complete LLM Logic Flow - ClubOS System

## Two Distinct Paths: Dashboard vs Customer Messages

### 1. DASHBOARD REQUEST CARD (Internal Employee Use)
**Path:** Frontend Dashboard → `/api/llm/request` → Assistant Service
- **Purpose:** For employees to ask questions and get internal-focused responses
- **Target Audience:** Staff/Operators/Admins
- **Response Style:** Technical, detailed, includes internal procedures
- **Context Flag:** `isCustomerFacing: false` (default)

**Flow:**
1. Employee types question in dashboard request card
2. Selects route (Auto/Emergency/Booking/TechSupport/BrandTone)
3. Request goes to `/api/llm/request`
4. Routes to appropriate assistant
5. Returns internal-focused response with full details

### 2. CUSTOMER MESSAGES (SMS via OpenPhone)
**Path:** OpenPhone Webhook → AI Automation Service → Assistant Service
- **Purpose:** Automated customer support via text messages
- **Target Audience:** Customers
- **Response Style:** Friendly, concise, customer-appropriate
- **Context Flag:** `isCustomerFacing: true`

**Flow:**
```
Customer sends SMS → OpenPhone webhook received
↓
AI Automation Service checks:
1. Is this the FIRST message? → Try to answer (LLM initial analysis if enabled)
2. Is this within existing conversation? → Check response limits
3. Has it been > 1 hour since last message? → New conversation
↓
If can answer with confidence > 0.8:
  → Send automated response
  → Track usage
If cannot answer:
  → Wait for human staff response
  → Learn from the interaction after 1 hour
```

## Key Decision Points

### Message Processing Logic

```javascript
// In aiAutomationService.processMessage():

1. CHECK KNOWLEDGE STORE FIRST (if enabled)
   - Search local knowledge
   - If confidence > 0.8 → Respond instantly
   - Save API costs

2. CHECK IF INITIAL MESSAGE
   - isInitialMessage = true for first customer message
   - Use LLM for analysis if "llm_initial_analysis" enabled
   - Try to answer common questions

3. CHECK RESPONSE LIMITS
   - Default: 2 responses per conversation for automations
   - Prevents spam and endless loops
   - Example: Gift cards allows 2 responses (initial + follow-up)

4. ROUTE DETERMINATION
   - Emergency: fire, injury, accident
   - Booking & Access: unlock, door, booking, cancel
   - TechSupport: trackman, frozen, equipment
   - BrandTone: membership, hours, gift cards
```

### Learning System (After 1 Hour)

```javascript
// When staff responds to a customer:
1. Message sent by staff via Messages page
2. System waits 1 hour after last activity
3. Extracts knowledge from conversation:
   - Customer question → Staff answer
   - Adds to knowledge_patterns table
   - Updates confidence scores
4. Next time similar question → Automated response
```

## Current Configuration

### AI Automation Features (from migration 055)
```sql
1. 'auto_respond' - DISABLED by default
   - Can send responses without human review
   - Confidence threshold: 0.85
   
2. 'auto_execute' - DISABLED by default
   - Can execute actions (reset trackman, unlock doors)
   - Confidence threshold: 0.90
   
3. 'knowledge_first' - ENABLED by default
   - Check local knowledge before OpenAI
   - Fallback to LLM if not found
```

### Response Differentiation

**For Dashboard (Internal):**
```javascript
context: { 
  isCustomerFacing: false 
}
// Returns technical details, procedures, internal info
```

**For Messages (Customer):**
```javascript
context: { 
  isCustomerFacing: true,
  conversationId: 'conv_xxx'
}
// Returns friendly, simplified, customer-safe responses
```

## Safety Mechanisms

1. **Confidence Thresholds**
   - Gift cards: 0.5 (lowered for simple queries)
   - Trackman reset: 0.7
   - Auto-response: 0.85
   - Auto-execute: 0.90

2. **Response Limits**
   - Max 2-3 automated responses per conversation
   - Prevents automation loops
   - Forces human handoff for complex issues

3. **1-Hour Conversation Window**
   - Messages within 1 hour = same conversation
   - After 1 hour = new conversation
   - Learning happens 1 hour after last message

4. **Customer Safety Filter**
   ```javascript
   ensureCustomerFacingResponse(response) {
     // Removes internal procedures
     // Simplifies technical language
     // Adds friendly tone
   }
   ```

## Data Flow Example: Gift Card Question

**Customer texts:** "Do you sell gift cards?"

1. **OpenPhone webhook** receives message
2. **AI Automation Service** processes:
   - Checks knowledge store: finds "giftcard.purchase.url"
   - Confidence: 1.0 (exact match)
3. **Auto-response** (if enabled):
   - "Yes! You can purchase gift cards at www.clubhouse247golf.com/giftcard/purchase"
4. **Tracking:**
   - Logs usage in `ai_automation_usage`
   - Updates pattern confidence
5. **Learning:**
   - If staff responds differently, system learns new phrasing

## Current Status

✅ **Working:**
- Knowledge store deployed (migration 054)
- AI automation tracking (migration 055)
- Dashboard/Customer routing differentiation
- 1-hour conversation grouping
- Pattern learning system

⚠️ **Needs Configuration:**
- Enable `auto_respond` for customer messages
- Set confidence thresholds per use case
- Configure which actions can be automated

🔄 **Next Steps:**
1. Test gift card automation end-to-end
2. Enable auto-response with high confidence
3. Monitor and adjust thresholds based on accuracy
4. Build simplified Knowledge UI for non-technical users