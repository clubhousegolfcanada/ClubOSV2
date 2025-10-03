#!/bin/bash
# Apply performance indexes migration (231) to production database

echo "================================="
echo "ClubOS Performance Index Migration"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}This script will apply 50+ database indexes to improve query performance.${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "ClubOSV1-backend/src/database/migrations/231_performance_indexes.sql" ]; then
    echo -e "${RED}Error: Migration file not found. Please run from the CLUBOSV1 root directory.${NC}"
    exit 1
fi

# Method 1: Using Railway CLI (Recommended)
echo "Method 1: Using Railway CLI (Recommended)"
echo "-----------------------------------------"
echo "Run the following command:"
echo ""
echo -e "${GREEN}railway run --service=clubosv1-backend npm run db:migrate:single 231${NC}"
echo ""
echo "Prerequisites:"
echo "  1. Railway CLI installed: npm install -g @railway/cli"
echo "  2. Logged in: railway login"
echo "  3. Linked to project: railway link"
echo ""

# Method 2: Direct Database Connection
echo "Method 2: Direct Database Connection"
echo "------------------------------------"
echo "If you have direct database access, run:"
echo ""
echo -e "${GREEN}cd ClubOSV1-backend${NC}"
echo -e "${GREEN}DATABASE_URL='your-production-database-url' npx tsx src/database/migrations/run-single-migration.ts 231${NC}"
echo ""

# Method 3: Manual SQL Application
echo "Method 3: Manual SQL Application"
echo "--------------------------------"
echo "Copy and run the SQL from the migration file directly:"
echo ""
echo -e "${GREEN}cat ClubOSV1-backend/src/database/migrations/231_performance_indexes.sql${NC}"
echo ""
echo "Then paste the SQL (UP section only) into your database client."
echo ""

# Safety Check
echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo "  • Indexes are created with IF NOT EXISTS (safe to re-run)"
echo "  • Creation may take 30-60 seconds for large tables"
echo "  • No data is modified, only indexes added"
echo "  • Monitor /api/performance after applying"
echo ""

# Verification
echo "After Migration Verification:"
echo "----------------------------"
echo "1. Check index count:"
echo -e "   ${GREEN}SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';${NC}"
echo "   Expected: 50+ indexes"
echo ""
echo "2. Test query performance:"
echo -e "   ${GREEN}curl https://your-app.railway.app/api/performance${NC}"
echo "   Look for 'performance indexes applied' in recommendations"
echo ""
echo "3. Monitor application:"
echo "   • Response times should improve 10-100x"
echo "   • Database CPU usage should decrease"
echo "   • No errors in application logs"
echo ""

echo "================================="
echo -e "${GREEN}Ready to boost ClubOS performance!${NC}"
echo "=================================">