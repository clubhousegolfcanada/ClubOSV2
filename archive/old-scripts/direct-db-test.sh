#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "Creating a debug endpoint to test SOP search..."

# Create a custom test endpoint
cat > test-sop-search.js << 'EOF'
// Add this endpoint to test SOP search
router.get('/test-sop-search/:query', authenticate, async (req, res) => {
  const { query } = req.params;
  
  try {
    // Direct database query
    const dbResult = await db.query(`
      SELECT id, assistant, title, 
             substring(content, 1, 200) as content_preview
      FROM sop_embeddings 
      WHERE content ILIKE $1 OR title ILIKE $1
      LIMIT 10
    `, [`%${query}%`]);
    
    // Test intelligent SOP module
    const sopDocs = await intelligentSOPModule.findRelevantContext(query, 'brand');
    
    // Test knowledge loader
    const knowledgeResults = await knowledgeLoader.unifiedSearch(query, {
      includeSOPEmbeddings: true,
      assistant: 'brand'
    });
    
    res.json({
      query,
      directDbResults: dbResult.rows.length,
      sopModuleResults: sopDocs.length,
      knowledgeLoaderResults: knowledgeResults.length,
      details: {
        db: dbResult.rows,
        sopModule: sopDocs.map(d => ({ id: d.id, title: d.title })),
        knowledgeLoader: knowledgeResults.map(k => ({ id: k.id, issue: k.issue }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
EOF

echo "Testing with custom endpoint (if available)..."

# First let's just check what the sop-check endpoint returns
echo -e "\n=== Raw SOP Check Response ==="
curl -s -X GET -H "Authorization: Bearer $TOKEN" "$API_URL/api/sop-check"

echo -e "\n\n=== Testing LLM Request with 7iron ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "What is 7iron?",
    "smartAssistEnabled": true,
    "routePreference": "BrandTone"
  }' \
  "$API_URL/api/llm/request"