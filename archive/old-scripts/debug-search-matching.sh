#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "DEBUGGING SEARCH MATCHING ISSUE"
echo "=========================================="
echo ""
echo "Your power outage query worked because it found:"
echo "- Skedda booking platform info ✓"
echo "- Automated monitoring info ✓"
echo ""
echo "But it's missing some procedure details."
echo ""
echo "Let's test different query phrasings..."
echo ""

# Test different phrasings for color palette
echo "Testing different ways to ask for colors:"
echo ""

color_queries=(
    "color palette"
    "brand colors"
    "what colors"
    "clubhouse colors"
    "purple and grey"
    "hex codes"
    "Color Palette"  # Exact match with capital letters
)

for query in "${color_queries[@]}"; do
    echo -n "Query: '$query' → "
    
    response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"requestDescription\": \"$query\",
        \"smartAssistEnabled\": true,
        \"routePreference\": \"BrandTone\"
      }" \
      "$API_URL/api/llm/request" 2>/dev/null)
    
    if echo "$response" | grep -q "Nobody told me"; then
        echo "❌ Not found"
    else
        echo "✅ Found something!"
        echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
response = data.get('data', {}).get('llmResponse', {}).get('response', '')
print(f'   Preview: {response[:100]}...')
" 2>/dev/null || echo "   (Could not parse response)"
    fi
    
    sleep 0.5
done

echo -e "\n\nTesting booking queries that should work:"
echo ""

booking_queries=(
    "changing booking"
    "modify reservation"
    "reschedule booking"
    "Changing a Booking Process"  # Exact title match
)

for query in "${booking_queries[@]}"; do
    echo -n "Query: '$query' → "
    
    response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"requestDescription\": \"$query\",
        \"smartAssistEnabled\": true,
        \"routePreference\": \"Booking & Access\"
      }" \
      "$API_URL/api/llm/request" 2>/dev/null)
    
    if echo "$response" | grep -q "Nobody told me"; then
        echo "❌ Not found"
    else
        echo "✅ Found!"
    fi
    
    sleep 0.5
done

echo -e "\n\n=========================================="
echo "WHAT'S HAPPENING:"
echo "=========================================="
echo ""
echo "The system IS using your database (SOP module active)."
echo "Some queries work, others don't because:"
echo ""
echo "1. Search might be too exact"
echo "   - Need fuzzy matching"
echo "   - Need synonym understanding"
echo ""
echo "2. Documents might have limited content"
echo "   - Your power query found Skedda info"
echo "   - But missing full procedures"
echo ""
echo "3. The intelligent search needs tuning"
echo "   - Should understand 'color palette' = 'Color Palette'"
echo "   - Should find partial matches"