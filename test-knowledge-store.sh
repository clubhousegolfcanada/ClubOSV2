#!/bin/bash

# Test Winston-style Knowledge Store API
# Tests the production API after deployment

API_URL="https://clubos-backend-production.up.railway.app/api"
TOKEN="YOUR_AUTH_TOKEN" # We'll test public endpoints first

echo "==========================================="
echo "🧠 Testing Winston-Style Knowledge Store API"
echo "==========================================="
echo ""

# 1. Test Health Check
echo "1️⃣ Testing Health Check..."
curl -s "${API_URL}/health" | jq '.' || echo "Health check failed"
echo ""

# 2. Test Knowledge Store - Add Gift Card URL
echo "2️⃣ Adding Gift Card Knowledge..."
curl -X POST "${API_URL}/knowledge-store" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "giftcard.purchase.url",
    "value": "https://www.clubhouse247golf.com/giftcard/purchase",
    "metadata": {
      "category": "customer_service",
      "description": "Direct link to purchase gift cards",
      "triggers": ["gift card", "gift certificate", "voucher", "present"],
      "confidence": 1.0
    }
  }' | jq '.'
echo ""

# 3. Test Knowledge Store - Add Hours
echo "3️⃣ Adding Hours Knowledge..."
curl -X POST "${API_URL}/knowledge-store" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "hours.bedford",
    "value": "Monday-Friday: 9am-11pm, Saturday-Sunday: 8am-11pm",
    "metadata": {
      "category": "business_info",
      "location": "Bedford",
      "confidence": 1.0
    }
  }' | jq '.'
echo ""

# 4. Test Knowledge Store - Add Trackman Reset Procedure
echo "4️⃣ Adding Trackman Reset Procedure..."
curl -X POST "${API_URL}/knowledge-store" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "procedures.trackman.reset",
    "value": {
      "title": "Reset Frozen Trackman",
      "steps": [
        "Press Windows key",
        "Type cmd and press Enter",
        "Run: trackman-reset.bat",
        "Wait 30 seconds for restart"
      ],
      "time": "2 minutes",
      "requires": "operator access"
    },
    "metadata": {
      "category": "technical",
      "triggers": ["trackman frozen", "ball wont pick up", "simulator not working", "screen frozen"],
      "confidence": 0.94,
      "success_rate": 0.94,
      "occurrences": 147
    }
  }' | jq '.'
echo ""

# 5. Test Search - Gift Cards
echo "5️⃣ Testing Search: 'How do I buy a gift card?'"
curl -X GET "${API_URL}/knowledge-store/search?q=how%20do%20i%20buy%20gift%20card" | jq '.'
echo ""

# 6. Test Search - Hours
echo "6️⃣ Testing Search: 'What are your hours?'"
curl -X GET "${API_URL}/knowledge-store/search?q=what%20are%20your%20hours" | jq '.'
echo ""

# 7. Test Search - Technical Issue
echo "7️⃣ Testing Search: 'The ball is not picking up'"
curl -X GET "${API_URL}/knowledge-store/search?q=ball%20not%20picking%20up" | jq '.'
echo ""

# 8. Test Pattern Matching
echo "8️⃣ Testing Pattern Detection..."
curl -X POST "${API_URL}/knowledge-store/pattern" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "the simulator is stuck",
    "solution": "Run trackman-reset.bat",
    "success": true
  }' | jq '.'
echo ""

# 9. Test Get All Knowledge
echo "9️⃣ Getting All Stored Knowledge..."
curl -X GET "${API_URL}/knowledge-store" | jq '.'
echo ""

# 10. Test Analytics
echo "🔟 Getting Knowledge Analytics..."
curl -X GET "${API_URL}/knowledge-store/analytics" | jq '.'
echo ""

echo "==========================================="
echo "✅ Knowledge Store API Test Complete"
echo "==========================================="
echo ""
echo "Summary:"
echo "- Winston-style API: set(), get(), search()"
echo "- Key-value storage with flexible JSON values"
echo "- Pattern learning and confidence tracking"
echo "- Full-text search across all knowledge"
echo ""
echo "Next Steps:"
echo "1. Check Railway logs for migration status"
echo "2. Add authentication token if needed"
echo "3. Test through the dashboard request card"
echo "4. Monitor pattern learning from conversations"