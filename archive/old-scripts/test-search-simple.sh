#!/bin/bash

# Simple test script for knowledge search
# Replace YOUR_AUTH_TOKEN with your actual auth token

AUTH_TOKEN="${1:-YOUR_AUTH_TOKEN}"
API_URL="https://clubosv2-production.up.railway.app"

echo "Testing ClubOS Knowledge Search..."
echo "=================================="
echo ""

# 1. System check
echo "1. System Configuration Check:"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_URL/api/system/check" | jq '.'

echo ""
echo "2. Testing Search for '7iron':"
curl -s -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "7iron"}' \
  "$API_URL/api/system/test-search" | jq '.'

echo ""
echo "3. Testing Assistant Response:"
curl -s -X POST -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "What is 7iron?"}' \
  "$API_URL/api/assistant/response" | jq '.'

echo ""
echo "4. Document Distribution:"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  "$API_URL/api/knowledge-debug/document-distribution" | jq '.data.totalDocuments, .data.categoryDistribution'