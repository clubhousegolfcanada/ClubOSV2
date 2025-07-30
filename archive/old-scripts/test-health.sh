#!/bin/bash

API_URL="https://clubosv2-production.up.railway.app"

echo "Testing ClubOS API Health..."
echo "==========================="
echo ""

echo "1. Basic Health Check:"
curl -s "$API_URL/health" | jq '.'

echo ""
echo "2. API Status:"
curl -s "$API_URL/api/llm/health" | jq '.'

echo ""
echo "To test authenticated endpoints, you need to:"
echo "1. Log into the ClubOS dashboard"
echo "2. Open browser DevTools (F12)"
echo "3. Go to Network tab"
echo "4. Make any request in the dashboard"
echo "5. Look for the Authorization header in the request"
echo "6. Copy the token after 'Bearer '"
echo ""
echo "Then run: ./test-search-simple.sh YOUR_TOKEN"