#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Checking system status ==="
curl -s -X GET -H "Authorization: Bearer $TOKEN" "$API_URL/api/system" | python3 -m json.tool 2>/dev/null || echo "System check failed"

echo -e "\n\n=== Checking SOP embeddings table directly ==="
# Create a simple endpoint to query the database
cat > test-sop-query.js << 'EOF'
// Add this to a route to test
router.get('/test-query', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT assistant) as assistants,
             array_agg(DISTINCT assistant) as assistant_list
      FROM sop_embeddings
    `);
    
    const sample = await db.query(`
      SELECT id, assistant, title, substring(content, 1, 100) as content_preview
      FROM sop_embeddings
      WHERE content ILIKE '%7iron%' OR title ILIKE '%7iron%'
      LIMIT 5
    `);
    
    res.json({
      summary: result.rows[0],
      matches: sample.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
EOF

echo -e "\n=== Testing knowledge search endpoint ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "7iron", "includeSOPEmbeddings": true}' \
  "$API_URL/api/knowledge/search" 2>&1 | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(json.dumps(data, indent=2))
except:
    print('Error parsing response')
    print(sys.stdin.read())
"