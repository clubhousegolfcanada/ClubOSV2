#!/bin/bash

# Test Redis Connection and Caching

echo "Testing ClubOS Redis Connection..."
echo "=================================="

# Your production URL
URL="https://clubosv2-production.up.railway.app"

# 1. Check health endpoint
echo -e "\n1. Checking health status..."
curl -s "$URL/api/llm/health" | json_pp

# 2. Make the same request twice to test caching
echo -e "\n2. Testing cache (making same request twice)..."

# First request (will be slow - hits OpenAI)
echo -e "\nFirst request (should take 5-8 seconds):"
time curl -s -X POST "$URL/api/llm/process" \
  -H "Content-Type: application/json" \
  -d '{"description": "What are the golf simulator hours?"}' \
  -o /dev/null -w "Status: %{http_code}\n"

# Wait a second
sleep 1

# Second request (should be instant - from cache)
echo -e "\nSecond request (should be <500ms from cache):"
time curl -s -X POST "$URL/api/llm/process" \
  -H "Content-Type: application/json" \
  -H "X-Debug: true" \
  -d '{"description": "What are the golf simulator hours?"}' \
  -I | grep -E "X-Cache|HTTP"

echo -e "\n✅ If second request was much faster, Redis caching is working!"