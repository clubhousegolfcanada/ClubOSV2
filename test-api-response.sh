#!/bin/bash

echo "Testing direct API response for 'screen frozen'..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "screen frozen",
    "routePreference": "Auto"
  }')

echo "Full API Response:"
echo "$RESPONSE" | jq '.'

echo ""
echo "Extracted response text:"
echo "$RESPONSE" | jq -r '.data.llmResponse.response'

echo ""
echo "Extracted actions:"
echo "$RESPONSE" | jq -r '.data.llmResponse.suggestedActions[]' 2>/dev/null || echo "No actions found"

echo ""
echo "Extracted info:"
echo "$RESPONSE" | jq '.data.llmResponse.extractedInfo' 2>/dev/null || echo "No extracted info"
