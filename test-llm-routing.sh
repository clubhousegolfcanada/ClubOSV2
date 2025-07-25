#!/bin/bash

# Test ClubOS LLM Routing
echo "🔍 Testing ClubOS LLM Routing System"
echo "===================================="
echo ""

# Test different route types
echo "1. Testing Emergency Route:"
curl -X POST https://clubosv2-production.up.railway.app/api/llm/debug-request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "There is a fire in the building, emergency help needed!"}' \
  | jq '.'

echo -e "\n2. Testing Booking & Access Route:"
curl -X POST https://clubosv2-production.up.railway.app/api/llm/debug-request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "I need to cancel my booking for tomorrow"}' \
  | jq '.'

echo -e "\n3. Testing TechSupport Route:"
curl -X POST https://clubosv2-production.up.railway.app/api/llm/debug-request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "The Trackman screen is frozen and not responding"}' \
  | jq '.'

echo -e "\n4. Testing BrandTone Route:"
curl -X POST https://clubosv2-production.up.railway.app/api/llm/debug-request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "What are your membership prices?"}' \
  | jq '.'

echo -e "\n5. Testing actual request endpoint:"
curl -X POST https://clubosv2-production.up.railway.app/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "The equipment is frozen", "location": "Bay 3"}' \
  | jq '.'
