#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Checking Database for Color/Branding Information ==="
echo ""

# Direct database search for color-related terms
echo "1. Searching database directly for color terms..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-check" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('\\nSearching for color/branding content:')
color_terms = ['color', 'purple', 'grey', 'gray', 'hex', 'rgb', '#503285', '#7B7B7B', 'brand', 'logo', 'visual', 'palette']
found_any = False
for term in color_terms:
    results = data.get('searchResults', {}).get(term, {})
    if results.get('count', 0) > 0:
        found_any = True
        print(f'\\n✓ Found {results[\"count\"]} entries for \"{term}\":')
        for sample in results.get('samples', [])[:3]:
            print(f'  Title: {sample[\"title\"]}')
            print(f'  Content: {sample[\"content_preview\"][:150]}...')
            print(f'  Assistant: {sample.get(\"assistant\", \"unknown\")}')
            print('  ---')

if not found_any:
    print('\\n✗ No color/branding information found in database')
    print('  This explains why queries are returning fallback responses')
"

echo -e "\n\n2. Testing if USE_INTELLIGENT_SOP is enabled..."
# Test a simple query to see which system responds
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "test"}' \
  "$API_URL/api/assistant/response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assistant_id = data.get('assistantId', '')
if 'sop-' in assistant_id:
    print('✓ USE_INTELLIGENT_SOP is enabled (using database)')
else:
    print('✗ USE_INTELLIGENT_SOP is disabled (using OpenAI assistants)')
    print('  Assistant ID:', assistant_id)
"

echo -e "\n\n3. Looking for any Clubhouse-specific content..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Clubhouse", "category": "brand", "topK": 5}' \
  "$API_URL/api/intelligent-search/search" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('resultCount', 0) > 0:
        print(f'\\n✓ Found {data[\"resultCount\"]} Clubhouse-related documents')
        for i, result in enumerate(data.get('results', [])[:3], 1):
            print(f'\\n{i}. {result[\"title\"]}')
            print(f'   {result[\"contentPreview\"][:150]}...')
    else:
        print('\\n✗ No Clubhouse-specific content found')
except:
    print('\\n✗ Intelligent search endpoint error')
"

echo -e "\n\n=== SUMMARY ==="
echo "If no color/branding data was found:"
echo "  1. The uploaded documents may not contain specific color information"
echo "  2. You may need to upload documents with brand guidelines"
echo "  3. Example content to add:"
echo "     - Clubhouse purple: #503285"
echo "     - Clubhouse grey: #7B7B7B"
echo "     - Logo colors and usage guidelines"