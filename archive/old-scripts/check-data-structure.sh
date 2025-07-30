#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Checking how data is structured in the database ==="

# Let's see some actual examples
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-check" | python3 -c "
import sys, json

data = json.load(sys.stdin)

print('CURRENT DATA STRUCTURE:')
print(f'Total documents: {data[\"total\"]}')
print(f'\\nRecent entries show how data is stored:')

for entry in data['recentEntries'][:5]:
    print(f\"\\nTitle: {entry['title']}\")
    print(f\"Category: {entry['assistant']}\")
    print(f\"ID: {entry['id']}\")
"

echo -e "\n\n=== Testing searchability ==="

# Test different search patterns
for term in "Nick Wang" "7-iron" "better golf" "projector" "wifi" "color code"; do
  echo -e "\nSearching for: '$term'"
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$term\", \"assistant\": \"brand\"}" \
    "$API_URL/api/sop-debug/debug" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"  Found: {data['results']['directDb']['count']} documents\")
except:
    print('  Search failed')
" || echo "  Error in search"
done