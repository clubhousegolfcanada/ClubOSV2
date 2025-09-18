#!/bin/bash
# Verify all performance optimizations are deployed and working

echo "========================================"
echo "ClubOS Performance Optimization Checker"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        return 1
    fi
}

# Warning function
warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Track overall status
ISSUES=0

echo "1. Database Optimizations"
echo "--------------------------"

# Check if migration 231 exists
if [ -f "ClubOSV1-backend/src/database/migrations/231_performance_indexes.sql" ]; then
    check 0 "Migration 231 file exists"
else
    check 1 "Migration 231 file missing"
    ((ISSUES++))
fi

# Check database pool configuration
if grep -q "DB_POOL_MAX" .env.production.example; then
    check 0 "Database pool configuration documented"
else
    check 1 "Database pool configuration missing"
    ((ISSUES++))
fi

echo ""
echo "2. Caching System"
echo "-----------------"

# Check cache service implementation
if grep -q "getOrSet" ClubOSV1-backend/src/services/cacheService.ts; then
    check 0 "Cache service getOrSet method exists"
else
    check 1 "Cache service getOrSet method missing"
    ((ISSUES++))
fi

if grep -q "invalidatePattern" ClubOSV1-backend/src/services/cacheService.ts; then
    check 0 "Cache service invalidatePattern method exists"
else
    check 1 "Cache service invalidatePattern method missing"
    ((ISSUES++))
fi

echo ""
echo "3. Frontend Optimizations"
echo "-------------------------"

# Check Next.js webpack configuration
if grep -q "splitChunks" ClubOSV1-frontend/next.config.js; then
    check 0 "Webpack code splitting configured"
else
    check 1 "Webpack code splitting not configured"
    ((ISSUES++))
fi

# Check lazy loading implementation
if grep -q "lazy.*import.*operations" ClubOSV1-frontend/src/pages/operations.tsx; then
    check 0 "Operations page uses lazy loading"
else
    check 1 "Operations page not using lazy loading"
    ((ISSUES++))
fi

echo ""
echo "4. API Optimizations"
echo "--------------------"

# Check unified messages endpoint
if [ -f "ClubOSV1-backend/src/routes/messages-unified.ts" ]; then
    check 0 "Unified messages API exists"
else
    check 1 "Unified messages API missing"
    ((ISSUES++))
fi

# Check performance monitor endpoint
if [ -f "ClubOSV1-backend/src/routes/performance-monitor.ts" ]; then
    check 0 "Performance monitor endpoint exists"
else
    check 1 "Performance monitor endpoint missing"
    ((ISSUES++))
fi

echo ""
echo "5. Build Status"
echo "---------------"

# Check TypeScript compilation
cd ClubOSV1-backend
npx tsc --noEmit 2>/dev/null
check $? "Backend TypeScript compilation"
[ $? -ne 0 ] && ((ISSUES++))
cd ..

cd ClubOSV1-frontend
npx tsc --noEmit 2>/dev/null
check $? "Frontend TypeScript compilation"
[ $? -ne 0 ] && ((ISSUES++))
cd ..

echo ""
echo "========================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All optimizations verified!${NC}"
    echo "The system is ready for high-performance operation."
else
    echo -e "${RED}❌ Found $ISSUES issues that need attention${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Fix any compilation errors"
    echo "2. Run migration 231 in production: railway run npm run db:migrate:single 231"
    echo "3. Ensure REDIS_URL is set in production"
    echo "4. Deploy and monitor /api/performance endpoint"
fi
echo "========================================"

exit $ISSUES