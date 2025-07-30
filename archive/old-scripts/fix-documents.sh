#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiJkOTg3OGVmYS1mZWVhLTQ4MWMtYmMyYi1lZTY0ODFkOGRjZTEiLCJpYXQiOjE3NTM3OTExNDAsImV4cCI6MTc1Mzg3NzU0MCwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.OMrVjmhGvfoNqDrUr8nAgegtK-aS2NdRP8GiNpmKl8I"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "DOCUMENT FIXING TOOL"
echo "=========================================="
echo ""
echo "This will improve document titles and fix content issues"
echo ""

echo "1. First, let's check for color documents with wrong data..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/api/admin/fix-color-documents" | python3 -m json.tool

echo -e "\n\n2. Start reprocessing all documents with better titles..."
echo "   This will run in the background and improve searchability"

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/api/admin/reprocess-documents" | python3 -m json.tool

echo -e "\n\n=========================================="
echo "WHAT THIS DOES:"
echo "=========================================="
echo ""
echo "✓ Improves generic titles like 'Color Palette' to:"
echo "  'Clubhouse Brand Colors - Purple #503285 and Grey #7B7B7B'"
echo ""
echo "✓ Adds searchable metadata and keywords"
echo ""
echo "✓ Identifies documents with wrong color data"
echo "  (Green instead of Purple)"
echo ""
echo "Check Railway logs to monitor progress."
echo ""
echo "After reprocessing, test with:"
echo "  ./test-actual-data.sh"