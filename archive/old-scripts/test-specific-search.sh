#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Testing search for 'Nick Wang' ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Nick Wang", "assistant": "brand"}' \
  "$API_URL/api/sop-debug/debug" | python3 -m json.tool

echo -e "\n\n=== Testing assistant response for 'Who is Nick Wang?' ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"route": "BrandTone", "description": "Who is Nick Wang?"}' \
  "$API_URL/api/assistant/response" | jq '.response'

echo -e "\n\n=== Testing LLM request for 'Tell me about 7iron' ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Tell me about 7iron and Nick Wang",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone"
  }' \
  "$API_URL/api/llm/request" | jq '.data.llmResponse.response'