#!/bin/bash

echo "🔍 Checking Backend Configuration"
echo "================================="
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

echo "1️⃣ Checking .env file..."
if [ -f ".env" ]; then
    echo "✅ .env exists"
    echo ""
    echo "JWT configuration:"
    grep -E "JWT|TOKEN" .env | sed 's/=.*$/=***/'
else
    echo "❌ .env missing!"
fi

echo ""
echo "2️⃣ Checking if JWT_SECRET is set..."
if grep -q "JWT_SECRET=" .env 2>/dev/null; then
    echo "✅ JWT_SECRET is configured"
else
    echo "❌ JWT_SECRET is missing!"
    echo ""
    echo "Adding JWT_SECRET to .env..."
    echo "JWT_SECRET=your-secret-key-change-this-in-production" >> .env
    echo "✅ Added JWT_SECRET"
fi

echo ""
echo "3️⃣ Current auth configuration:"
echo "================================"
grep -A 2 -B 2 "JWT_SECRET" src/routes/auth.ts 2>/dev/null || echo "Using config from middleware/auth.ts"

echo ""
echo "If you're still getting 'invalid token', restart the backend after this check."
