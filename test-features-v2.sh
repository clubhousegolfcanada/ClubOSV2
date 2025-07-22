#!/bin/bash

echo "🔍 ClubOS Feature Testing Script (v2)"
echo "===================================="
echo ""

echo "1. Checking backend status..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ Backend is running"
    curl -s http://localhost:3001/health | jq '.'
else
    echo "✗ Backend is not running"
    echo "  Start it with: npm run dev"
fi
echo ""

echo "2. Checking frontend status..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Frontend is running"
else
    echo "✗ Frontend is not running"
    echo "  Start it with: npm run dev"
fi
echo ""

echo "3. Testing request routing (with delays to avoid rate limit)..."
echo "   a) Testing Booking route:"
curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "I need to book bay 3 for tomorrow at 2pm",
    "routePreference": "Auto"
  }' | jq '.data.botRoute' 2>/dev/null && echo "   ✓ Booking routing works" || echo "   ✗ Booking routing failed"

sleep 1  # Wait 1 second between requests

echo "   b) Testing Emergency route:"
curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "There is water flooding in bay 2, emergency help needed",
    "routePreference": "Auto"
  }' | jq '.data.botRoute' 2>/dev/null && echo "   ✓ Emergency routing works" || echo "   ✗ Emergency routing failed"

sleep 1  # Wait 1 second between requests

echo "   c) Testing Tech route:"
curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "The trackman screen is frozen and not responding",
    "routePreference": "Auto"
  }' | jq '.data.botRoute' 2>/dev/null && echo "   ✓ Tech routing works" || echo "   ✗ Tech routing failed"
echo ""

echo "4. Testing knowledge base..."
KB_RESPONSE=$(curl -s http://localhost:3001/api/knowledge)
if echo "$KB_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✓ Knowledge base endpoint works"
    echo "  Found $(echo "$KB_RESPONSE" | jq '.count') knowledge bases"
else
    echo "✗ Knowledge base endpoint failed"
fi
echo ""

echo "5. Testing knowledge base search..."
echo "   Testing 'Screen frozen' solution:"
SOLUTION=$(curl -s -X POST http://localhost:3001/api/knowledge/solution \
  -H "Content-Type: application/json" \
  -d '{"symptoms": ["Screen frozen"]}')
  
if echo "$SOLUTION" | jq -e '.solutions[0]' > /dev/null 2>&1; then
    echo "✓ Found solution for frozen screen"
    echo "$SOLUTION" | jq '.solutions[0] | {issue: .issue, priority: .priority, customerScript: .customerScript}'
else
    echo "✗ No solution found for frozen screen"
fi
echo ""

echo "6. Testing complete LLM request with knowledge base..."
FULL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Screen frozen",
    "routePreference": "Auto"
  }')
  
echo "Full response structure:"
echo "$FULL_RESPONSE" | jq '{
  route: .data.botRoute,
  response: .data.llmResponse.response,
  confidence: .data.llmResponse.confidence,
  suggestedActions: .data.llmResponse.suggestedActions,
  extractedInfo: .data.llmResponse.extractedInfo
}'
echo ""

echo "===================================="
echo "Testing Complete!"
echo ""
echo "Next steps:"
echo "1. Check if detailed responses are showing in the UI"
echo "2. For production setup, update .env with real API keys"
echo "3. Create GPT assistants in OpenAI dashboard"
