#!/bin/bash

TOKEN="YOUR_NEW_TOKEN_HERE"
API_URL="https://clubosv2-production.up.railway.app"

echo "Testing specific competitor queries..."
echo ""

queries=(
    "Tell me about 7-iron"
    "Who is Nick Wang"
    "7-iron golf simulator"
    "competitor 7-iron"
    "Nick Wang 7-iron"
)

for query in "${queries[@]}"; do
    echo "Query: '$query'"
    echo "---"
    # Add your test here when you have a valid token
    echo ""
done

echo "If these queries don't find the 7-iron/Nick Wang info,"
echo "it means the document needs better keywords or the"
echo "search needs to be more intelligent about variations."