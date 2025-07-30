#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Creating endpoint to search for variations of 7iron ==="

# Create a test that searches for different variations
cat > search-variations.js << 'EOF'
// Add to a route to test different search patterns
router.post('/search-variations', authenticate, async (req, res) => {
  const { term } = req.body;
  
  const variations = [
    term,
    term.toLowerCase(),
    term.toUpperCase(),
    term.replace(/[^a-zA-Z0-9]/g, ''),
    `%${term}%`,
    `% ${term} %`,
    `%${term.replace(' ', '%')}%`
  ];
  
  const results = {};
  
  for (const variation of variations) {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count,
               array_agg(DISTINCT substring(content, position(lower($1) in lower(content)) - 20, 100)) as snippets
        FROM sop_embeddings 
        WHERE lower(content) LIKE lower($1)
           OR lower(title) LIKE lower($1)
      `, [variation]);
      
      results[variation] = {
        count: result.rows[0].count,
        snippets: result.rows[0].snippets || []
      };
    } catch (err) {
      results[variation] = { error: err.message };
    }
  }
  
  res.json({ term, results });
});
EOF

# Test direct SQL-like searches
echo "Testing variations of '7iron' search..."

# Try different search patterns
for term in "7iron" "7 iron" "seven iron" "7-iron" "iron" "BetterGolf" "better golf" "fan"; do
  echo -e "\n=== Searching for: $term ==="
  curl -s -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$term\", \"assistant\": \"brand\"}" \
    "$API_URL/api/sop-debug/debug" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Direct DB results: {data['results']['directDb']['count']}\")
if data['results']['directDb']['count'] > 0:
    for doc in data['results']['directDb']['documents']:
        print(f\"  - {doc['title']}: {doc['content_preview'][:50]}...\")
"
done