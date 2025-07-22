#!/bin/bash

# Test ClubOS API endpoints

echo "Testing ClubOS API..."
echo ""

# Test health endpoint
echo "1. Testing health endpoint:"
curl -s http://localhost:3001/health | jq .
echo ""

# Test LLM status
echo "2. Testing LLM status:"
curl -s http://localhost:3001/api/llm/status | jq .
echo ""

# Test knowledge base
echo "3. Testing knowledge base:"
curl -s http://localhost:3001/api/knowledge | jq .
echo ""

# Test LLM request
echo "4. Testing LLM request:"
curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Customer locked out and forgot their access code",
    "location": "Bay 3",
    "routePreference": "Auto"
  }' | jq .
echo ""

# Test knowledge search
echo "5. Testing knowledge search:"
curl -s -X POST http://localhost:3001/api/knowledge/test \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Customer says equipment is frozen"
  }' | jq .