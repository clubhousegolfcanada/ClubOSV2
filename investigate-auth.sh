#!/bin/bash

echo "=== AUTH INVESTIGATION REPORT ==="
echo ""

echo "1. Checking environment variables..."
echo "Backend JWT_SECRET exists: $([ -f ClubOSV1-backend/.env ] && grep -c "^JWT_SECRET=" ClubOSV1-backend/.env || echo "0")"
echo "Frontend API URL: $([ -f ClubOSV1-frontend/.env.local ] && grep "^NEXT_PUBLIC_API_URL=" ClubOSV1-frontend/.env.local || echo "Not found")"

echo ""
echo "2. Checking recent git changes..."
git log --oneline -5

echo ""
echo "3. Checking backend auth middleware..."
grep -n "jwt.verify" ClubOSV1-backend/src/middleware/auth.ts | head -3

echo ""
echo "4. Testing direct login to backend..."
curl -X POST https://clubosv1-backend-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mike@clubhouse247golf.com","password":"Admin123"}' \
  -s | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "5. Checking database for user..."
