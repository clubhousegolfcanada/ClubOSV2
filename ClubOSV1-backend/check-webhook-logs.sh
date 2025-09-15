#!/bin/bash
echo "=== Checking for webhook activity in last 10 minutes ==="
echo ""
echo "1. Checking for any OpenPhone webhook hits:"
railway logs 2>/dev/null | grep -i "openphone.*webhook" | tail -10

echo ""
echo "2. Checking for messages from 902-478-3209:"
railway logs 2>/dev/null | grep -E "9024783209|902.*478.*3209" | tail -5

echo ""
echo "3. Checking for webhook signature failures:"
railway logs 2>/dev/null | grep -i "signature" | tail -5

echo ""
echo "4. Checking for any webhook errors:"
railway logs 2>/dev/null | grep -E "webhook.*error|401.*webhook" | tail -5
