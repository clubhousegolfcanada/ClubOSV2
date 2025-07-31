#!/bin/bash

# Simple script to check messages API
echo "Checking Messages API directly..."
echo ""

# You need to provide your auth token
if [ -z "$AUTH_TOKEN" ]; then
    echo "Please run: export AUTH_TOKEN='your-clubos-token'"
    echo "You can get this from browser DevTools > Application > Local Storage > clubos_token"
    exit 1
fi

# Check conversations endpoint
echo "=== Checking Conversations API ==="
curl -s -X GET "https://clubosv2-production.up.railway.app/api/messages/conversations" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'

echo ""
echo "=== Checking OpenPhone Debug Database ==="
curl -s -X GET "https://clubosv2-production.up.railway.app/api/debug-openphone/database-check" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'