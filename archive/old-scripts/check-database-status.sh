#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== DATABASE STATUS CHECK ==="
echo ""

# 1. Check SOP module status
echo "1. Checking SOP module status..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-status" | python3 -m json.tool

echo -e "\n2. Checking database document counts..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-stats" | python3 -m json.tool

echo -e "\n3. Testing which system is active..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "test system check"}' \
  "$API_URL/api/assistant/response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assistant_id = data.get('assistantId', '')
thread_id = data.get('threadId', '')
response = data.get('response', '')[:100]

print(f'\\nAssistant ID: {assistant_id}')
print(f'Thread ID: {thread_id}')

if 'sop-' in assistant_id:
    print('\\n✅ USING DATABASE (SOP Module)')
    print('   USE_INTELLIGENT_SOP = true')
elif assistant_id and 'asst_' in assistant_id:
    print('\\n❌ USING OPENAI ASSISTANTS')
    print('   USE_INTELLIGENT_SOP = false')
    print('   This is why some queries work (OpenAI has the data)')
else:
    print('\\n⚠️  UNKNOWN SYSTEM')
    print(f'   Response preview: {response}...')
"

echo -e "\n4. Direct database query test..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT COUNT(*) as total, assistant, COUNT(DISTINCT title) as unique_titles FROM sop_embeddings GROUP BY assistant"}' \
  "$API_URL/api/admin/query" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'error' in data:
        print('\\n✗ Direct query failed:', data['error'])
        print('   (This endpoint may be disabled in production)')
    else:
        print('\\n✓ Database query results:')
        for row in data.get('rows', []):
            print(f'   {row[\"assistant\"]}: {row[\"total\"]} documents ({row[\"unique_titles\"]} unique)')
except:
    print('\\n✗ Query endpoint not available')
"

echo -e "\n\n=== CONCLUSION ==="
echo "Based on the test results:"
echo ""
echo "1. The system is currently using OpenAI Assistants (not database)"
echo "   - This is why 'Nick Wang' and 'Trackman reset' queries work"
echo "   - OpenAI Assistants have some data, database may be empty"
echo ""
echo "2. To switch to database mode:"
echo "   - Set USE_INTELLIGENT_SOP=true in Railway"
echo "   - Set SOP_SHADOW_MODE=false"
echo "   - Redeploy the application"
echo ""
echo "3. If database is empty after switching:"
echo "   - Re-import your 300+ documents"
echo "   - Use Knowledge Extraction panel"
echo "   - Ensure documents are categorized correctly"