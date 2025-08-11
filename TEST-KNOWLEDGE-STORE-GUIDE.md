# How to Test the Knowledge Store System

## Quick Test Methods

### 1. Test Through Dashboard (Easiest)
1. **Login** to https://clubos-frontend.vercel.app
2. **Go to Dashboard**
3. **Use the Request Card:**
   - Type: "How do I buy a gift card?"
   - Select Route: AI (or BrandTone)
   - Click "PROCESS REQUEST"
   - Watch if it checks knowledge store first (check Railway logs)

### 2. Test Through Messages (Customer Flow)
1. **Go to Messages page**
2. **Send a test message** to yourself:
   - Use a test phone number
   - Text: "Do you sell gift cards?"
3. **Check if AI responds** (if auto-response enabled)
4. **Monitor in Railway logs** to see if it checked knowledge store

### 3. Direct API Testing (Developer)

```bash
# Get auth token first
curl -X POST https://clubosv2-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clubhouse247golf.com","password":"YOUR_PASSWORD"}'

# Save the token from response
TOKEN="your_jwt_token_here"

# Add knowledge
curl -X POST https://clubosv2-production.up.railway.app/api/knowledge-store \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "giftcard.url",
    "value": "https://www.clubhouse247golf.com/giftcard/purchase",
    "metadata": {
      "category": "customer_service",
      "confidence": 1.0
    }
  }'

# Search knowledge
curl -X GET "https://clubosv2-production.up.railway.app/api/knowledge-store/search?q=gift%20card" \
  -H "Authorization: Bearer $TOKEN"

# Test through assistant
curl -X POST https://clubosv2-production.up.railway.app/api/assistant/response \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "route": "BrandTone",
    "description": "How do I buy a gift card?"
  }'
```

## Step-by-Step Test Plan

### Phase 1: Add Test Knowledge
1. **Login to dashboard**
2. **Navigate to Operations > AI Automations** (if UI exists)
3. **Or use API to add:**
   ```json
   {
     "giftcard.url": "https://www.clubhouse247golf.com/giftcard/purchase",
     "hours.all": "We're open 24/7, 365 days a year!",
     "wifi.password": "Clubhouse2024",
     "trackman.reset": "Press Windows key, type cmd, run trackman-reset.bat"
   }
   ```

### Phase 2: Test Retrieval
1. **Ask questions through dashboard:**
   - "What are your hours?" → Should return "24/7"
   - "WiFi password?" → Should return "Clubhouse2024"
   - "How to buy gift cards?" → Should return URL

2. **Check Railway logs** for:
   ```
   Using knowledge from database
   source: knowledge_store
   confidence: 1.0
   ```

### Phase 3: Test Learning
1. **Send customer message** that isn't in knowledge
2. **Staff responds** with answer
3. **Wait 1 hour**
4. **Check if system learned** the pattern

## Monitor in Railway Logs

```bash
# Watch live logs
railway logs

# Look for these key messages:
"Checking knowledge store first"
"Knowledge found with confidence: 0.95"
"Using local knowledge - no API call needed"
"Learning from staff response"
```

## Test Scenarios

### ✅ Should Work Instantly (if knowledge added):
- "How do I buy a gift card?"
- "What are your hours?"
- "What's the WiFi password?"
- "How do I reset trackman?"

### ❌ Should Fall Back to OpenAI:
- "What's the weather today?"
- "Can you write me a poem?"
- Complex technical issues not in knowledge

### 🔄 Should Learn From:
- New questions staff answers
- Variations of existing questions
- Successful problem resolutions

## Quick Verification Checklist

- [ ] Backend deployed (check https://clubosv2-production.up.railway.app/health)
- [ ] Migrations ran (check Railway logs for migration 054 & 055)
- [ ] Can add knowledge via API
- [ ] Dashboard searches knowledge first
- [ ] Messages check knowledge before OpenAI
- [ ] Learning happens after 1 hour

## Test Data File

Create `test-knowledge.txt`:
```
Q: How do I buy a gift card?
A: Visit https://www.clubhouse247golf.com/giftcard/purchase

Q: What are your hours?
A: We're open 24/7, 365 days a year!

Q: What's the WiFi password?
A: Clubhouse2024

Q: How do I reset a frozen trackman?
A: Press Windows key, type cmd, run trackman-reset.bat

Q: Do you have parking?
A: Yes, free parking available at all locations

Q: Can I bring food?
A: Yes, outside food and drinks are welcome
```

Upload via API:
```bash
curl -X POST https://clubosv2-production.up.railway.app/api/knowledge-store/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-knowledge.txt"
```

## Expected Results

**Before Knowledge Store:**
- Every question → OpenAI API call
- Cost: ~$0.01 per question
- Response time: 2-3 seconds

**After Knowledge Store:**
- Common questions → Instant local response
- Cost: $0 (no API call)
- Response time: <100ms
- Only unknown questions → OpenAI

## Success Metrics

- 📊 70%+ questions answered locally
- 💰 80%+ reduction in OpenAI costs
- ⚡ 95%+ faster response times
- 📈 Confidence scores increasing over time
- 🎯 Pattern detection working