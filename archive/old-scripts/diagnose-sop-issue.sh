#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "DIAGNOSING SOP MODULE ISSUE"
echo "=========================================="
echo ""
echo "You said: USE_INTELLIGENT_SOP=true, SOP_SHADOW_MODE=false"
echo "Let's verify what's actually happening..."
echo ""

# 1. Check if the assistant endpoint is using SOP
echo "1. Testing assistant endpoint..."
response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "What colors are in the color palette?"}' \
  "$API_URL/api/assistant/response")

echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    assistant_id = data.get('assistantId', '')
    response_text = data.get('response', '')
    
    print(f'Assistant ID: {assistant_id}')
    
    if 'sop-' in assistant_id:
        print('✅ SOP Module is ACTIVE (using database)')
        if 'Nobody told me' in response_text:
            print('❌ But returning fallback - search not finding documents')
        else:
            print('✅ And found data!')
    else:
        print('❌ Still using OpenAI Assistants')
        print('   Check if deployment completed')
        
    print(f'\\nResponse preview: {response_text[:150]}...')
except Exception as e:
    print(f'Error parsing response: {e}')
"

# 2. Test the dashboard request endpoint
echo -e "\n\n2. Testing dashboard request endpoint..."
response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Show me the color palette",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone"
  }' \
  "$API_URL/api/llm/request")

echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        llm_response = data['data']['llmResponse']
        response_text = llm_response.get('response', '')
        confidence = llm_response.get('confidence', 0)
        
        print(f'Confidence: {confidence}')
        
        if 'Nobody told me' in response_text:
            print('❌ Getting fallback response')
            print('   Database search is not working properly')
        else:
            print('✅ Got a real response')
            
        print(f'\\nResponse: {response_text[:200]}...')
except Exception as e:
    print(f'Error: {e}')
"

# 3. Check if the intelligent search endpoint exists
echo -e "\n\n3. Testing intelligent search endpoint directly..."
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "color", "category": "brand", "topK": 3}' \
  "$API_URL/api/intelligent-search/search")

http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
response_body=$(echo "$response" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $http_status"

if [ "$http_status" = "404" ]; then
    echo "❌ Intelligent search endpoint not found!"
    echo "   The endpoint may not be deployed"
elif [ "$http_status" = "500" ]; then
    echo "❌ Server error in intelligent search"
    echo "   Check Railway logs for errors"
elif [ "$http_status" = "200" ]; then
    echo "✅ Endpoint exists"
    echo "$response_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    count = data.get('resultCount', 0)
    if count > 0:
        print(f'✅ Found {count} results!')
    else:
        print('❌ No results returned')
        print('   Search is not finding documents')
except:
    print('❌ Invalid response format')
"
fi

# 4. Try a simpler SOP status check
echo -e "\n\n4. Checking SOP module status..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-status" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data:
        print('SOP Status:', json.dumps(data, indent=2))
    else:
        print('Empty response')
except:
    print('No valid JSON response')
"

echo -e "\n\n=========================================="
echo "POSSIBLE ISSUES:"
echo "=========================================="
echo ""
echo "1. If you're getting 'sop-BrandTone' but fallback responses:"
echo "   → SOP is active but search isn't working"
echo "   → Check if database connection is working"
echo ""
echo "2. If you're still getting OpenAI assistant IDs:"
echo "   → Deployment may not have completed"
echo "   → Environment variables may not have updated"
echo "   → Try redeploying on Railway"
echo ""
echo "3. If intelligent search returns 404:"
echo "   → The new endpoints aren't deployed"
echo "   → Check Railway build logs"
echo ""
echo "Check Railway logs for any errors!"