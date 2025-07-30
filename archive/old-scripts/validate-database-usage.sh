#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Checking Current Configuration ==="
echo "1. Checking if USE_INTELLIGENT_SOP is enabled..."

# Check system config
curl -s -X GET -H "Authorization: Bearer $TOKEN" "$API_URL/health" | grep -q "ok" && echo "✓ API is up" || echo "✗ API is down"

echo -e "\n2. Testing with Smart Assist ON (should use database if USE_INTELLIGENT_SOP=true)..."

# Test a query that we know exists in the database
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Who is Nick Wang?",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone"
  }' \
  "$API_URL/api/llm/request" | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('data', {}).get('llmResponse', {}).get('response', '')
if 'Nobody told me that answer yet' in response:
    print('✗ Using fallback response - NOT using database')
elif 'Nick Wang' in response and 'Owner' in response:
    print('✓ Found Nick Wang info - USING DATABASE!')
else:
    print('? Unknown response:', response[:100])
"

echo -e "\n3. Testing with Smart Assist OFF (should go to Slack)..."

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Test with Smart Assist OFF",
    "smartAssistEnabled": false,
    "location": "Test Location"
  }' \
  "$API_URL/api/llm/request" | python3 -c "
import sys, json
data = json.load(sys.stdin)
status = data.get('data', {}).get('status', '')
if status == 'sent_to_slack':
    print('✓ Sent to Slack - correct behavior')
else:
    print('✗ Did not send to Slack:', status)
"

echo -e "\n4. Testing intelligent search directly..."

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "7iron competitor",
    "category": "brand"
  }' \
  "$API_URL/api/intelligent-search/search" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    count = data.get('resultCount', 0)
    if count > 0:
        print(f'✓ Intelligent search found {count} results')
    else:
        print('✗ Intelligent search found 0 results')
except:
    print('✗ Intelligent search endpoint not available')
"