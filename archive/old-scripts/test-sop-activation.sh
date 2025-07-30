#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "TESTING SOP MODULE ACTIVATION"
echo "=========================================="
echo ""

# Test 1: Direct test to see which system responds
echo "1. Testing which system is responding..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "test"}' \
  "$API_URL/api/assistant/response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assistant_id = data.get('assistantId', 'none')
response = data.get('response', '')

print(f'Assistant ID: {assistant_id}')

if 'sop-' in assistant_id:
    print('✅ SOP MODULE IS ACTIVE!')
    print('   The system is using the database')
elif 'asst_' in assistant_id:
    print('❌ OpenAI Assistant is active')
    print('   USE_INTELLIGENT_SOP is not working')
else:
    print('⚠️  Unknown response type')
    
print(f'\\nResponse preview: {response[:100]}...')
"

# Test 2: Check if we can query the Color Palette directly
echo -e "\n\n2. Testing Color Palette query..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Show me the color palette",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone"
  }' \
  "$API_URL/api/llm/request" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    response = data['data']['llmResponse']['response']
    if 'Nobody told me' in response:
        print('❌ Not finding Color Palette document')
    else:
        print('✅ Found information!')
        print(f'Response: {response[:200]}...')
"

echo -e "\n\n=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo ""
echo "If you see '❌ OpenAI Assistant is active':"
echo "1. Go to Railway dashboard"
echo "2. Click on your backend service"
echo "3. Go to Settings → Variables"
echo "4. Make sure these are set:"
echo "   USE_INTELLIGENT_SOP=true"
echo "   SOP_SHADOW_MODE=false"
echo "5. Click the Redeploy button"
echo "6. Wait 2-3 minutes"
echo "7. Run this test again"
echo ""
echo "Your database HAS the Color Palette document."
echo "Once SOP module activates, it will find it!"