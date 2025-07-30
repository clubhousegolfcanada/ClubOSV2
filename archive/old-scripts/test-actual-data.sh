#!/bin/bash

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMTkwNWJjYy0xYjZkLTQxMjQtOTFjYS1iZDc0ZDM5YmQ1NTEiLCJlbWFpbCI6Im1pa2VAY2x1YmhvdXNlMjQ3Z29sZi5jb20iLCJyb2xlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOiIzNzA4MDg5Ni01MTc1LTQ0MjYtYmVkZC0zOThhMmI3ZDYwY2YiLCJpYXQiOjE3NTM3NjM3NTEsImV4cCI6MTc1Mzg1MDE1MSwiYXVkIjoiY2x1Ym9zdjEtdXNlcnMiLCJpc3MiOiJjbHVib3N2MSJ9.VvgwFPel_9EWx8u6GDcZ3Zpiz7JZ2rSn0-TEZwbf35k"
API_URL="https://clubosv2-production.up.railway.app"

echo "=========================================="
echo "TESTING ACTUAL DATABASE CONTENT"
echo "=========================================="
echo ""

# First check what's actually in the database
echo "1. Checking what content exists in database..."
curl -s -X GET -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/sop-data-check" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('\\nSearching for known content:')

# Test for various known content
test_terms = [
    'trackman', 'reset', 'restart',  # Tech procedures
    'nick wang', 'team', 'staff',    # Team members
    '7-iron', 'better golf',          # Competitors
    'booking', 'cancel', 'refund',    # Booking procedures
    'emergency', 'fire', 'injury',    # Emergency procedures
    'troubleshoot', 'error', 'fix'    # Tech support
]

categories = {'tech': [], 'brand': [], 'booking': [], 'emergency': []}
total_found = 0

for term in test_terms:
    results = data.get('searchResults', {}).get(term, {})
    if results.get('count', 0) > 0:
        total_found += results['count']
        print(f'\\n✓ Found {results[\"count\"]} entries for \"{term}\"')
        for sample in results.get('samples', [])[:1]:
            assistant = sample.get('assistant', 'unknown')
            if assistant in categories:
                categories[assistant].append(term)
            print(f'  Category: {assistant}')
            print(f'  Title: {sample[\"title\"]}')
            print(f'  Preview: {sample[\"content_preview\"][:100]}...')

print(f'\\n\\nTotal documents found: {total_found}')
print('\\nContent by category:')
for cat, terms in categories.items():
    if terms:
        print(f'  {cat}: {len(set(terms))} different topics found')
"

echo -e "\n\n2. Testing dashboard queries for ACTUAL content..."

# Test queries that should work based on your data
test_queries=(
    "Who is Nick Wang?"
    "How do I reset a Trackman?"
    "Who is part of the Clubhouse team?"
    "What do I do if Trackman is not working?"
    "Tell me about 7-iron competitor"
    "How to troubleshoot simulator issues"
    "What are the emergency procedures?"
    "How to handle booking cancellations"
)

for query in "${test_queries[@]}"; do
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing: \"$query\""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Determine best route based on query
    route="BrandTone"
    if [[ "$query" == *"reset"* ]] || [[ "$query" == *"Trackman"* ]] || [[ "$query" == *"troubleshoot"* ]] || [[ "$query" == *"simulator"* ]]; then
        route="TechSupport"
    elif [[ "$query" == *"booking"* ]] || [[ "$query" == *"cancel"* ]]; then
        route="Booking & Access"
    elif [[ "$query" == *"emergency"* ]]; then
        route="Emergency"
    fi
    
    # Test through dashboard
    response=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"requestDescription\": \"$query\",
        \"smartAssistEnabled\": true,
        \"routePreference\": \"$route\",
        \"location\": \"Test\"
      }" \
      "$API_URL/api/llm/request" 2>/dev/null)
    
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        response_text = data['data']['llmResponse']['response']
        route_used = data['data']['botRoute']
        
        print(f'Route: {route_used}')
        
        if 'Nobody told me that answer yet' in response_text:
            print('❌ FAIL: Got fallback response')
            print('   System is not finding data in database')
        else:
            # Check if response contains relevant information
            query_lower = '''$query'''.lower()
            response_lower = response_text.lower()
            
            relevant_keywords = {
                'nick wang': ['nick', 'wang', 'owner', '7-iron'],
                'trackman': ['trackman', 'restart', 'reset', 'power', 'unplug'],
                'team': ['team', 'staff', 'member', 'employee'],
                '7-iron': ['7-iron', '7iron', 'competitor', 'nick wang'],
                'simulator': ['simulator', 'bay', 'troubleshoot', 'restart'],
                'emergency': ['emergency', 'fire', 'injury', 'evacuation'],
                'booking': ['booking', 'cancel', 'refund', 'reservation']
            }
            
            found_relevant = False
            for key, keywords in relevant_keywords.items():
                if key in query_lower:
                    for keyword in keywords:
                        if keyword in response_lower:
                            found_relevant = True
                            break
            
            if found_relevant:
                print('✅ SUCCESS: Found relevant information!')
                print(f'Response preview: {response_text[:200]}...')
            else:
                print('⚠️  WARNING: Got response but may not be relevant')
                print(f'Response preview: {response_text[:200]}...')
    else:
        print('✗ Request failed:', data.get('error', 'Unknown error'))
except Exception as e:
    print(f'✗ Error processing response: {e}')
"
done

echo -e "\n\n=========================================="
echo "ANALYSIS"
echo "=========================================="
echo ""
echo "Check the results above:"
echo "  ✅ SUCCESS = Database is working correctly"
echo "  ❌ FAIL = System not using database (check USE_INTELLIGENT_SOP)"
echo "  ⚠️  WARNING = Database working but content may need improvement"
echo ""
echo "Common issues:"
echo "  1. USE_INTELLIGENT_SOP=false (still using OpenAI)"
echo "  2. Database queries not finding relevant content"
echo "  3. Smart routing sending to wrong assistant"
echo ""
echo "Your actual data includes:"
echo "  - Nick Wang and 7-iron competitor info (brand)"
echo "  - Trackman reset procedures (tech)"
echo "  - Team member information (brand)"
echo "  - Troubleshooting guides (tech)"
echo "  - Emergency procedures (emergency)"
echo "  - Booking policies (booking)"