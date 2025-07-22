#!/bin/bash

echo "Testing exact symptom match..."
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Screen frozen",
    "location": "Bay 3",
    "routePreference": "Auto"
  }' | jq .

echo -e "\n\nTesting knowledge base directly..."
curl -X POST http://localhost:3001/api/knowledge/test \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Screen frozen"
  }' | jq .

echo -e "\n\nTesting symptom search..."
curl -X POST http://localhost:3001/api/knowledge/solution \
  -H "Content-Type: application/json" \
  -d '{
    "symptoms": ["Screen frozen", "frozen", "screen"]
  }' | jq .