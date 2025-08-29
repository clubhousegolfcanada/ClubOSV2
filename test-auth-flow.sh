#!/bin/bash

echo "=== Testing Authentication Flow ==="
echo ""

# 1. Login and get token
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -X POST https://clubosv2-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mike@clubhouse247golf.com","password":"Admin123"}' \
  -s)

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token from login"
  echo "$LOGIN_RESPONSE" | python3 -m json.tool | head -20
  exit 1
fi

echo "Got token: ${TOKEN:0:50}..."
echo ""

# 2. Use token to fetch users
echo "2. Testing /api/auth/users with token..."
curl -X GET https://clubosv2-production.up.railway.app/api/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -s -w "\nHTTP Status: %{http_code}\n" | tail -1

echo ""
echo "3. Testing /api/settings/customer_auto_approval with token..."
curl -X GET https://clubosv2-production.up.railway.app/api/settings/customer_auto_approval \
  -H "Authorization: Bearer $TOKEN" \
  -s -w "\nHTTP Status: %{http_code}\n" | tail -1

echo ""
echo "4. Decoding token to check contents..."
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool 2>/dev/null | head -20
