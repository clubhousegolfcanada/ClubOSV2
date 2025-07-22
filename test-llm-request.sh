#!/bin/bash

echo "Testing LLM request with knowledge base..."
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "trackman is frozen",
    "location": "Bay 3",
    "routePreference": "Auto"
  }' | jq .