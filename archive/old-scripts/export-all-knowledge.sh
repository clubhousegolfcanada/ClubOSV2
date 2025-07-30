#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYy1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=== Exporting all knowledge to CSV ==="

# Create export endpoint
cat > export-knowledge.js << 'EOF'
router.get('/export-csv', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        assistant as category,
        title,
        content,
        created_at,
        metadata->>'imported' as imported,
        metadata->>'confidence' as confidence
      FROM sop_embeddings
      ORDER BY assistant, created_at DESC
    `);
    
    // Convert to CSV
    const csv = [
      'ID,Category,Title,Content,Created,Imported,Confidence',
      ...result.rows.map(row => 
        `"${row.id}","${row.category}","${row.title}","${row.content.replace(/"/g, '""')}","${row.created_at}","${row.imported}","${row.confidence}"`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=knowledge-export.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
EOF

# For now, let's get the data via API
echo "Fetching all documents..."

curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-check" | python3 -c "
import sys, json, csv
data = json.load(sys.stdin)

# Write summary
print(f\"Total documents: {data['total']}\")
print(f\"\\nBy Category:\")
for cat in data['byAssistant']:
    print(f\"  {cat['assistant']}: {cat['count']} documents\")

# Export to CSV
with open('knowledge-export.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Category', 'Search Term', 'Found Count', 'Sample Content'])
    
    for term, results in data['searchResults'].items():
        if results['count'] > 0:
            for sample in results['samples']:
                writer.writerow([
                    sample['assistant'],
                    term,
                    results['count'],
                    sample['content_preview'][:100]
                ])

print(f\"\\nExported to knowledge-export.csv\")
"