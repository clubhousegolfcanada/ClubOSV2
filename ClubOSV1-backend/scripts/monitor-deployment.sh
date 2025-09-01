#!/bin/bash

echo "🔍 Monitoring Railway deployment..."
echo "Looking for key indicators of new code deployment:"
echo ""

# Check health endpoint
echo "1. Health check:"
curl -s https://clubosv2-production.up.railway.app/health | python3 -m json.tool 2>/dev/null || echo "Health check failed"
echo ""

# Test auth endpoint without token to see error message
echo "2. Testing auth middleware (should show clean error):"
curl -s -X POST https://clubosv2-production.up.railway.app/api/slack/reply \
  -H "Content-Type: application/json" \
  -d '{"thread_ts": "test", "text": "test"}' 2>&1 | python3 -m json.tool 2>/dev/null || \
  curl -s -X POST https://clubosv2-production.up.railway.app/api/slack/reply \
  -H "Content-Type: application/json" \
  -d '{"thread_ts": "test", "text": "test"}'
echo ""

echo "3. Signs of successful deployment:"
echo "   ✅ No 'blacklisted_tokens' errors in response"
echo "   ✅ Clean 'No token provided' error message"
echo "   ✅ Health endpoint shows 'database: connected'"
echo ""
echo "If you still see 'blacklisted_tokens' errors, the deployment hasn't completed yet."