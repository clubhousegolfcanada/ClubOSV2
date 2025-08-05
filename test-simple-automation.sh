#!/bin/bash

echo "🧪 Testing Gift Card Automation Flow"
echo "==================================="
echo ""

# Test 1: Check if gift_cards automation is enabled
echo "1️⃣ Checking if gift_cards automation is enabled..."
railway run psql -t -c "SELECT enabled FROM ai_automation_features WHERE feature_key = 'gift_cards';" 2>/dev/null || echo "Failed to check"

# Test 2: Check if llm_initial_analysis is enabled
echo ""
echo "2️⃣ Checking if llm_initial_analysis is enabled..."
railway run psql -t -c "SELECT enabled FROM ai_automation_features WHERE feature_key = 'llm_initial_analysis';" 2>/dev/null || echo "Failed to check"

# Test 3: Check for gift card knowledge
echo ""
echo "3️⃣ Checking for gift card knowledge in database..."
railway run psql -t -c "SELECT COUNT(*) FROM knowledge_audit_log WHERE LOWER(new_value) LIKE '%gift%card%' OR LOWER(new_value) LIKE '%giftcard%';" 2>/dev/null || echo "Failed to check"

# Test 4: Check environment variables
echo ""
echo "4️⃣ Checking critical environment variables..."
railway variables | grep -E "(OPENAI_API_KEY|OPENPHONE_DEFAULT_NUMBER|BOOKING_ACCESS_GPT_ID)" | wc -l | xargs -I {} echo "Found {} critical variables configured"

# Test 5: Send test webhook
echo ""
echo "5️⃣ Sending test webhook message..."
curl -s -X POST https://clubosv2-production.up.railway.app/api/openphone/webhook \
  -H "Content-Type: application/json" \
  -H "X-OpenPhone-Signature: test" \
  -d '{
    "type": "message.created",
    "data": {
      "object": {
        "id": "test-'$(date +%s)'",
        "body": "Do you sell gift cards?",
        "from": "+19024783209",
        "to": "+18337779449",
        "direction": "inbound",
        "conversationId": "test-conv-'$(date +%s)'",
        "createdAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
      }
    }
  }' | jq . 2>/dev/null || echo "Webhook returned non-JSON response"

# Test 6: Check recent automation usage
echo ""
echo "6️⃣ Checking recent automation usage (last 24 hours)..."
railway run psql -t -c "
SELECT COUNT(*) as attempts, 
       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
       SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as errors
FROM ai_automation_usage au
JOIN ai_automation_features af ON au.feature_id = af.id
WHERE af.feature_key = 'gift_cards' 
  AND au.created_at > NOW() - INTERVAL '24 hours';
" 2>/dev/null || echo "Failed to check"

echo ""
echo "✅ Test complete!"