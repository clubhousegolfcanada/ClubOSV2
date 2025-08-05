# LLM Automation Investigation Results

## Summary
The LLM does monitor and process incoming OpenPhone messages, but the feature has never worked in production because:
1. OpenAI API key is not configured
2. OpenAI Assistant IDs are not configured
3. The `llm_initial_analysis` feature was disabled by default (now enabled via migration 043)

## How It's Supposed to Work

### Message Flow
1. **OpenPhone Webhook** receives incoming message
2. **AI Automation Service** processes the message:
   - If `llm_initial_analysis` is enabled AND it's an initial message
   - Calls GPT-4o-mini to analyze if automation should respond
3. **LLM Analysis** determines:
   - Should we respond automatically?
   - What's the detected intent? (gift_card, hours, location, etc.)
   - Confidence level
4. **Assistant Query**:
   - If LLM says respond, it queries the appropriate OpenAI Assistant
   - Uses 'Booking & Access' assistant for gift cards
   - Passes `isCustomerFacing: true` to ensure safe responses
5. **Response Sent** back through OpenPhone

## What's Missing

### 1. OpenAI Configuration
The system expects these environment variables:
```bash
# Required for any AI features
OPENAI_API_KEY=sk-...

# Required for assistant responses (must create in OpenAI platform)
BOOKING_ACCESS_GPT_ID=asst_...
EMERGENCY_GPT_ID=asst_...
TECH_SUPPORT_GPT_ID=asst_...
BRAND_MARKETING_GPT_ID=asst_...
```

### 2. OpenAI Assistants Setup
You need to:
1. Go to https://platform.openai.com/assistants
2. Create 4 assistants with appropriate instructions
3. Get their IDs (format: `asst_xxxxxxxxxxxxxxxxxx`)
4. Add to environment variables

### 3. Database Feature Flag
Migration 043 now enables `llm_initial_analysis` by default, but the database needs to be connected.

## Code Path Traced

1. **Webhook Entry**: `/api/openphone/webhook` (openphone.ts:258-299)
2. **AI Processing**: `aiAutomationService.processMessage()` 
3. **LLM Check**: `shouldUseLLMForInitial()` checks database flag
4. **LLM Analysis**: `analyzewithLLM()` uses GPT-4o-mini
5. **Assistant Query**: `assistantService.getAssistantResponse()`
6. **OpenAI Call**: Creates thread, sends message, waits for response
7. **Response Formatting**: Ensures customer-safe response
8. **Send via OpenPhone**: `openPhoneService.sendMessage()`

## Key Features Discovered

### Response Limits
- Can limit responses per conversation (e.g., 2 for gift cards)
- Tracks in `ai_automation_response_counts` table

### Assistant Routing
Messages are categorized into:
- Emergency
- Booking & Access (handles gift cards)
- TechSupport
- BrandTone

### Safety Features
- `isCustomerFacing: true` adds safety instructions
- Filters out internal information
- No employee names or technical details

### Fallback Behavior
- If LLM analysis fails → falls back to pattern matching
- If no OpenAI key → returns generic fallback response
- If no assistant ID → throws error

## Next Steps to Enable

1. **Add OpenAI API Key** to production environment
2. **Create OpenAI Assistants** and add their IDs
3. **Deploy migration 043** to enable LLM analysis
4. **Test with real message** through OpenPhone webhook
5. **Monitor logs** for automation responses

## Testing Without Production
The test script at `src/test/test-llm-automation-flow.ts` can simulate the flow locally if you have:
- OpenAI API key
- Database connection
- Assistant IDs configured