#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "TESTING SPECIFIC DOCUMENTS FROM DATABASE"
echo "=========================================="
echo ""
echo "✅ CONFIRMED: SOP Module IS ACTIVE!"
echo "   (Your power outage query proved this)"
echo ""
echo "Testing queries for documents we saw in your screenshot..."
echo ""

# Test queries based on exact titles from the screenshot
queries=(
    "Show me the color palette"
    "What are the logo usage guidelines"
    "Tell me about typography standards"
    "Explain the communication principles"
    "What are the digital brand standards"
    "Show me website guidelines"
    "How do I change a booking"
    "What is the customer notification template"
)

routes=(
    "BrandTone"
    "BrandTone"
    "BrandTone"
    "BrandTone"
    "BrandTone"
    "BrandTone"
    "Booking & Access"
    "Booking & Access"
)

for i in "${!queries[@]}"; do
    query="${queries[$i]}"
    route="${routes[$i]}"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Query: \"$query\""
    echo "Route: $route"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"requestDescription\": \"$query\",
        \"smartAssistEnabled\": true,
        \"routePreference\": \"$route\"
      }" \
      "$API_URL/api/llm/request")
    
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        response_text = data['data']['llmResponse']['response']
        
        if 'Nobody told me' in response_text:
            print('❌ Not finding document')
        else:
            # Check if it's returning structured data or actual content
            if response_text.strip().startswith('{'):
                print('✅ Found structured data!')
            else:
                print('✅ Found content!')
            print(f'Response preview: {response_text[:150]}...')
            print('')
except Exception as e:
    print(f'Error: {e}')
"
    
    # Small delay to avoid rate limiting
    sleep 0.5
done

echo -e "\n=========================================="
echo "ANALYSIS"
echo "=========================================="
echo ""
echo "If most queries return '❌ Not finding document':"
echo "→ The intelligent search may need adjustment"
echo "→ Document titles/content may not match queries"
echo ""
echo "If some work and others don't:"
echo "→ Working queries match document content better"
echo "→ Failed queries need better search terms"
echo ""
echo "Your database definitely has these documents:"
echo "- Color Palette (brand)"
echo "- Logo Usage (brand)"
echo "- Typography (brand)"
echo "- And 300+ more"