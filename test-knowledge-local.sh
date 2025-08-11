#!/bin/bash

# Test Winston-style Knowledge Store API Locally
# Tests the local development API

API_URL="http://localhost:5005/api"

echo "==========================================="
echo "🧠 Testing Winston-Style Knowledge Store API (Local)"
echo "==========================================="
echo ""

# 1. Test Health Check
echo "1️⃣ Testing Health Check..."
curl -s "${API_URL}/health" | jq '.' || echo "Health check failed"
echo ""

# 2. Test Knowledge Store - Add Gift Card URL (correct URL)
echo "2️⃣ Adding Gift Card Knowledge..."
curl -X POST "${API_URL}/knowledge-store" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "giftcard.purchase.url",
    "value": "https://www.clubhouse247golf.com/giftcard/purchase",
    "metadata": {
      "category": "customer_service",
      "description": "Direct link to purchase gift cards",
      "triggers": ["gift card", "gift certificate", "voucher", "present", "birthday gift"],
      "confidence": 1.0
    }
  }' | jq '.'
echo ""

# 3. Test Search - Various gift card phrasings
echo "3️⃣ Testing Search Variations..."
echo "   Search: 'gift card'"
curl -s -X GET "${API_URL}/knowledge-store/search?q=gift%20card" | jq '.'
echo ""

echo "   Search: 'do you sell gift certificates'"
curl -s -X GET "${API_URL}/knowledge-store/search?q=do%20you%20sell%20gift%20certificates" | jq '.'
echo ""

echo "   Search: 'birthday present for a golfer'"
curl -s -X GET "${API_URL}/knowledge-store/search?q=birthday%20present%20for%20a%20golfer" | jq '.'
echo ""

# 4. Test Get by Key
echo "4️⃣ Testing Get by Key..."
curl -s -X GET "${API_URL}/knowledge-store/key/giftcard.purchase.url" | jq '.'
echo ""

# 5. Test Update with Pattern Learning
echo "5️⃣ Testing Pattern Update..."
curl -X PUT "${API_URL}/knowledge-store/giftcard.purchase.url" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "https://www.clubhouse247golf.com/giftcard/purchase",
    "metadata": {
      "category": "customer_service",
      "description": "Direct link to purchase gift cards",
      "triggers": ["gift card", "gift certificate", "voucher", "present", "birthday gift", "christmas gift"],
      "confidence": 1.0,
      "usage_count": 25,
      "last_used": "2025-08-11T00:00:00Z"
    }
  }' | jq '.'
echo ""

# 6. Test Analytics
echo "6️⃣ Getting Knowledge Analytics..."
curl -s -X GET "${API_URL}/knowledge-store/analytics" | jq '.'
echo ""

echo "==========================================="
echo "✅ Winston-Style API Test Complete"
echo "==========================================="
echo ""
echo "Key Features Tested:"
echo "✅ set() - Add knowledge with key-value pairs"
echo "✅ get() - Retrieve by exact key"
echo "✅ search() - Full-text search across all knowledge"
echo "✅ update() - Modify and add patterns"
echo "✅ analytics() - Usage statistics"
echo ""
echo "Next: Test through the dashboard request card"