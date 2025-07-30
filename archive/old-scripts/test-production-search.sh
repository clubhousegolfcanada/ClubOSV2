#!/bin/bash

# Production Knowledge Search Test Script
# Usage: ./test-production-search.sh YOUR_API_KEY

API_KEY="${1:-your-api-key-here}"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Testing Production Knowledge Search ==="
echo ""

# 1. Check document distribution
echo "1. Checking document distribution..."
curl -s -H "Authorization: Bearer $API_KEY" \
  "$API_URL/api/knowledge-debug/document-distribution" | jq '.'

echo ""
echo "2. Testing direct search for '7iron'..."
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "7iron", "category": "brand"}' \
  "$API_URL/api/knowledge-debug/direct-search" | jq '.'

echo ""
echo "3. Testing semantic search..."
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is 7iron?"}' \
  "$API_URL/api/knowledge-debug/semantic-search" | jq '.'

echo ""
echo "4. Testing diagnosis..."
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is 7iron?"}' \
  "$API_URL/api/knowledge-debug/diagnose" | jq '.'

echo ""
echo "5. Testing main assistant endpoint..."
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "What is 7iron?"}' \
  "$API_URL/api/assistant/response" | jq '.'