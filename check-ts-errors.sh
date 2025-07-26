#!/bin/bash
echo "🔍 Checking TypeScript compilation errors"
echo "========================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Try to compile and see errors
echo "Running TypeScript compiler..."
npx tsc --noEmit

echo -e "\n📝 Checking if database files exist..."
ls -la src/utils/database.ts 2>/dev/null || echo "database.ts not found"
ls -la src/routes/tickets.ts 2>/dev/null || echo "tickets.ts not found"
ls -la src/routes/feedback.ts 2>/dev/null || echo "feedback.ts not found"
ls -la src/routes/auth.ts 2>/dev/null || echo "auth.ts not found"
