#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "FULL FLOW VALIDATION TEST"
echo "Testing: Dashboard → Smart Assist → Database → Response"
echo "=========================================="
echo ""

# Step 1: Verify USE_INTELLIGENT_SOP is enabled
echo "1. Checking system configuration..."
echo "   - USE_INTELLIGENT_SOP should be 'true' to use database"
echo "   - SOP_SHADOW_MODE should be 'false' for production use"
echo ""

# Step 2: Search database directly for branding content
echo "2. Searching database for branding/color information..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "clubhouse branding colors logo purple grey", "category": "brand", "topK": 10}' \
  "$API_URL/api/intelligent-search/search" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('resultCount', 0) > 0:
        print(f'✓ Found {data[\"resultCount\"]} results in database')
        color_found = False
        for result in data.get('results', []):
            content = result.get('content', '').lower()
            title = result.get('title', '')
            if any(word in content for word in ['purple', 'grey', 'gray', '#503285', 'hex', 'rgb', 'color']):
                print(f'✓ Found color info: {title}')
                print(f'  Preview: {result[\"contentPreview\"][:100]}...')
                color_found = True
        if not color_found:
            print('⚠️  No specific color information found in results')
    else:
        print('✗ No results found in database search')
except Exception as e:
    print(f'✗ Search failed: {e}')
"

echo -e "\n3. Testing dashboard request with Smart Assist ON..."
echo "   Query: 'What are the Clubhouse branding colors?'"
echo ""

# Main test - Dashboard request
response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "What are the Clubhouse branding colors?",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone",
    "location": "Main Office"
  }' \
  "$API_URL/api/llm/request" 2>/dev/null)

# Parse and display response
echo "$response" | python3 -c "
import sys, json

def check_response(response_text):
    '''Check if response contains actual color information'''
    color_indicators = [
        'purple', 'grey', 'gray', '#503285', '#7B7B7B', 
        'hex', 'rgb', 'color code', 'brand color'
    ]
    found_indicators = []
    for indicator in color_indicators:
        if indicator.lower() in response_text.lower():
            found_indicators.append(indicator)
    return found_indicators

try:
    data = json.load(sys.stdin)
    if data.get('success'):
        response_text = data['data']['llmResponse']['response']
        route = data['data']['botRoute']
        confidence = data['data']['llmResponse'].get('confidence', 'N/A')
        
        print(f'✓ Request processed successfully')
        print(f'  Route: {route}')
        print(f'  Confidence: {confidence}')
        print(f'\\nResponse Content:')
        print('=' * 60)
        print(response_text)
        print('=' * 60)
        
        # Check response quality
        if 'Nobody told me that answer yet' in response_text:
            print('\\n❌ FAIL: Got fallback response - database not being used!')
            print('   The system is not finding the information in the database.')
            print('   Check that USE_INTELLIGENT_SOP=true in production.')
        else:
            found_colors = check_response(response_text)
            if found_colors:
                print(f'\\n✅ SUCCESS: Found color information!')
                print(f'   Detected: {\", \".join(found_colors)}')
                print('   The dashboard is correctly retrieving data from the database.')
            else:
                print('\\n⚠️  WARNING: Got a response but no specific color codes found')
                print('   The system may be using generic responses instead of database content.')
    else:
        print('✗ Request failed:', data.get('error'))
except Exception as e:
    print(f'✗ Failed to parse response: {e}')
    print('Raw response:', sys.stdin.read())
"

echo -e "\n\n4. Testing variations to ensure context understanding..."

# Test variations
variations=("brand guidelines" "logo colors" "what color is clubhouse purple" "clubhouse color scheme")

for query in "${variations[@]}"; do
  echo -e "\n   Testing: '$query'"
  
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"requestDescription\": \"$query\", \"smartAssistEnabled\": true, \"routePreference\": \"BrandTone\"}" \
    "$API_URL/api/llm/request" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    response = data.get('data', {}).get('llmResponse', {}).get('response', '')
    if 'Nobody told me' in response:
        print('   ✗ Fallback response')
    elif any(word in response.lower() for word in ['purple', 'grey', '#503285', 'color']):
        print('   ✓ Found color information')
    else:
        print('   ? Got response but no colors mentioned')
except:
    print('   ✗ Failed to get response')
" || echo "   ✗ Request failed"
done

echo -e "\n\n=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo ""
echo "If all tests passed with ✅ SUCCESS:"
echo "  → The dashboard is correctly using the database"
echo "  → Smart Assist is routing to the SOP module"
echo "  → The intelligent search is finding relevant content"
echo ""
echo "If you see ❌ FAIL or 'Nobody told me':"
echo "  → Check that USE_INTELLIGENT_SOP=true in Railway"
echo "  → Verify documents exist in sop_embeddings table"
echo "  → Ensure the intelligent search service is running"
echo ""
echo "Next steps:"
echo "  1. Set USE_INTELLIGENT_SOP=true in Railway environment"
echo "  2. Redeploy the application"
echo "  3. Run this test again to confirm"