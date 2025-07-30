#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "Checking SOP embeddings for 7iron content..."

# Check what's in sop_embeddings table
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-check" | jq '.data.documents[] | select(.content | test("7iron"; "i")) | {title, assistant, contentPreview: .content[0:200]}'

echo -e "\n\nTesting unified search endpoint..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "7iron", "includeSOPEmbeddings": true}' \
  "$API_URL/api/knowledge/search" | jq '.'