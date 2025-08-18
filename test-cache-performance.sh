#!/bin/bash

echo "Testing Cache Performance..."
echo "============================"

# Test the public endpoint (no auth required)
URL="https://clubosv2-production.up.railway.app"

# 1. First request - will be slow (hits OpenAI)
echo -e "\n1. First request (expect 5-8 seconds):"
START=$(date +%s)
curl -s -X POST "$URL/api/public/llm/process" \
  -H "Content-Type: application/json" \
  -d '{"description": "What are the hours for the golf simulator?", "name": "Test User"}' \
  -o response1.json
END=$(date +%s)
DIFF1=$((END - START))
echo "Response time: ${DIFF1} seconds"

# 2. Second identical request - should be cached
echo -e "\n2. Second identical request (expect <1 second from cache):"
START=$(date +%s)
curl -s -X POST "$URL/api/public/llm/process" \
  -H "Content-Type: application/json" \
  -d '{"description": "What are the hours for the golf simulator?", "name": "Test User"}' \
  -o response2.json
END=$(date +%s)
DIFF2=$((END - START))
echo "Response time: ${DIFF2} seconds"

# 3. Calculate improvement
if [ $DIFF1 -gt 0 ]; then
  IMPROVEMENT=$(( (DIFF1 - DIFF2) * 100 / DIFF1 ))
  echo -e "\n📊 Performance Improvement: ${IMPROVEMENT}%"
  
  if [ $IMPROVEMENT -gt 50 ]; then
    echo "✅ Cache is working! Second request was ${IMPROVEMENT}% faster!"
  else
    echo "⚠️ Cache might not be working. Check Redis connection."
  fi
fi

# Show response (first 200 chars)
echo -e "\nSample response:"
head -c 200 response1.json

# Clean up
rm -f response1.json response2.json