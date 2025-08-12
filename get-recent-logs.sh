#!/bin/bash

echo "Fetching recent Railway logs..."
echo "================================"
echo ""

# Get logs and search for our debugging markers
railway logs 2>/dev/null | tail -100 | grep -E "🔍|📊|❌ CRITICAL|gift|Knowledge search|LOCAL KNOWLEDGE|OpenAI Assistant" | tail -30

echo ""
echo "================================"
echo "Looking for any errors..."
railway logs 2>/dev/null | tail -50 | grep -E "error|Error|ERROR|failed|Failed" | tail -10