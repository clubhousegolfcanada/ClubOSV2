#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Testing Clubhouse Branding Colors Search ==="
echo "This test validates the full flow from dashboard to database"
echo ""

# First, let's see what's in the database about branding/colors
echo "1. Checking what branding data exists in database..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-check" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('\\nSearching for color/branding content in database:')
for term in ['color', 'brand', 'logo', 'hex', 'purple', 'grey']:
    results = data.get('searchResults', {}).get(term, {})
    if results.get('count', 0) > 0:
        print(f'✓ Found {results[\"count\"]} entries for \"{term}\"')
        for sample in results.get('samples', [])[:2]:
            print(f'  - {sample[\"title\"]}: {sample[\"content_preview\"][:60]}...')
"

echo -e "\n\n2. Testing intelligent search for 'clubhouse branding colors'..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "clubhouse branding colors", "category": "brand"}' \
  "$API_URL/api/intelligent-search/search" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('resultCount', 0) > 0:
        print(f'✓ Intelligent search found {data[\"resultCount\"]} results')
        for result in data.get('results', [])[:3]:
            print(f'  - {result[\"title\"]}: {result[\"contentPreview\"][:60]}...')
    else:
        print('✗ No results found in intelligent search')
except:
    print('✗ Intelligent search failed')
"

echo -e "\n\n3. Testing assistant response for branding colors..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "What are the Clubhouse branding colors?"}' \
  "$API_URL/api/assistant/response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('response', '')
if 'Nobody told me that answer yet' in response:
    print('✗ Assistant returned fallback response - not finding data')
    print('Response:', response[:200])
else:
    print('✓ Assistant found information:')
    print(response)
"

echo -e "\n\n4. Testing dashboard request (full flow with Smart Assist ON)..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "What are the Clubhouse branding colors and color codes?",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone",
    "location": "Main Office"
  }' \
  "$API_URL/api/llm/request" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    response = data['data']['llmResponse']['response']
    route = data['data']['botRoute']
    confidence = data['data']['llmResponse']['confidence']
    
    print(f'✓ Request processed successfully')
    print(f'  Route: {route}')
    print(f'  Confidence: {confidence}')
    print(f'\\nResponse from dashboard:')
    print('-' * 50)
    print(response)
    print('-' * 50)
    
    # Check if it found actual color information
    if any(word in response.lower() for word in ['purple', 'grey', 'gray', '#503285', 'hex', 'rgb']):
        print('\\n✅ SUCCESS: Found actual branding color information!')
    elif 'Nobody told me' in response:
        print('\\n❌ FAIL: Got fallback response - database search not working')
    else:
        print('\\n⚠️  PARTIAL: Got a response but no specific color codes found')
else:
    print('✗ Request failed:', data.get('error'))
"

echo -e "\n\n5. Alternative queries to test context understanding..."
for query in "logo color" "what color is our logo" "brand guidelines colors" "clubhouse purple"; do
  echo -e "\nTesting: '$query'"
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"requestDescription\": \"$query\", \"smartAssistEnabled\": true, \"routePreference\": \"BrandTone\"}" \
    "$API_URL/api/llm/request" | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('data', {}).get('llmResponse', {}).get('response', '')[:100]
if 'Nobody told me' in response:
    print('  ✗ Fallback response')
else:
    print(f'  ✓ Found: {response}...')
" 2>/dev/null || echo "  ✗ Failed"
done