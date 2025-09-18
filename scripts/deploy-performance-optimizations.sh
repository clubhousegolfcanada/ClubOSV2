#!/bin/bash

# Performance Optimization Deployment Script
# Run this after deploying the performance optimization changes

set -e

echo "==============================================="
echo "ClubOS Performance Optimization Deployment"
echo "==============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "ClubOSV1-backend" ]; then
    echo -e "${RED}Error: Must run from ClubOS root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Running from correct directory${NC}"
echo ""

# Step 2: Check Railway CLI
echo "Checking Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi
echo -e "${GREEN}✓ Railway CLI available${NC}"
echo ""

# Step 3: Check Redis configuration
echo "Checking Redis configuration..."
echo "To check if Redis is configured in production, run:"
echo -e "${YELLOW}railway variables | grep REDIS${NC}"
echo ""
echo "If REDIS_URL is not set, you can add Redis to Railway by:"
echo "1. Go to Railway dashboard"
echo "2. Click '+ New' → 'Database' → 'Add Redis'"
echo "3. Connect it to your project"
echo ""
read -p "Is Redis configured? (y/n/skip): " redis_configured

if [ "$redis_configured" = "n" ]; then
    echo -e "${YELLOW}Please add Redis to your Railway project first${NC}"
    echo "Visit: https://railway.app/dashboard"
    exit 1
elif [ "$redis_configured" = "y" ]; then
    echo -e "${GREEN}✓ Redis configured${NC}"
fi
echo ""

# Step 4: Run database migration for indexes
echo "Running database migration 231 (Performance Indexes)..."
echo -e "${YELLOW}This will add 50+ indexes to improve query performance${NC}"
read -p "Run migration 231 now? (y/n): " run_migration

if [ "$run_migration" = "y" ]; then
    echo "Running migration on production database..."
    cd ClubOSV1-backend

    # Run the specific migration
    railway run npx tsx src/database/migrations/run-single-migration.ts 231

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration 231 applied successfully${NC}"
    else
        echo -e "${RED}Migration failed. Check logs with: railway logs${NC}"
        exit 1
    fi
    cd ..
else
    echo -e "${YELLOW}Skipped migration. Run it later with:${NC}"
    echo "cd ClubOSV1-backend && railway run npm run db:migrate"
fi
echo ""

# Step 5: Add performance monitoring endpoint
echo "Creating performance monitoring endpoint..."
cat > ClubOSV1-backend/src/routes/performance-monitor.ts << 'EOF'
import { Router } from 'express';
import { getPoolStats } from '../utils/db';
import { cacheService } from '../services/cacheService';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Performance monitoring endpoint (admin only)
router.get('/api/admin/performance', adminAuth, async (req, res) => {
  try {
    const poolStats = getPoolStats();
    const cacheStats = cacheService.getStats();

    const stats = {
      database: {
        pool: poolStats,
        status: poolStats.idle > 0 ? 'healthy' : 'warning'
      },
      cache: {
        ...cacheStats,
        status: cacheService.isAvailable() ? 'connected' : 'disconnected'
      },
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        unit: 'MB'
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance stats' });
  }
});

export default router;
EOF

echo -e "${GREEN}✓ Performance monitoring endpoint created${NC}"
echo "Access at: /api/admin/performance (requires admin auth)"
echo ""

# Step 6: Verify deployment
echo "Deployment verification steps:"
echo "1. Check if the app is running:"
echo -e "   ${YELLOW}railway status${NC}"
echo ""
echo "2. Check recent logs:"
echo -e "   ${YELLOW}railway logs --tail 50${NC}"
echo ""
echo "3. Test performance endpoint (after deploying):"
echo -e "   ${YELLOW}curl https://your-app.railway.app/api/admin/performance -H 'Authorization: Bearer YOUR_TOKEN'${NC}"
echo ""

# Step 7: Performance testing commands
echo "==============================================="
echo "Performance Testing Commands"
echo "==============================================="
echo ""
echo "# Check database connection pool:"
echo -e "${YELLOW}railway run npx tsx -e \"const {getPoolStats} = require('./dist/utils/db'); console.log(getPoolStats())\"${NC}"
echo ""
echo "# Check cache status:"
echo -e "${YELLOW}railway run npx tsx -e \"const {cacheService} = require('./dist/services/cacheService'); console.log(cacheService.getStats())\"${NC}"
echo ""
echo "# Run database query performance test:"
echo -e "${YELLOW}railway run psql \$DATABASE_URL -c \"EXPLAIN ANALYZE SELECT * FROM tickets WHERE status = 'open' AND location = 'Bedford';\"${NC}"
echo ""

echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}Performance optimization deployment complete!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor performance metrics at /api/admin/performance"
echo "2. Check cache hit rates after 24 hours"
echo "3. Compare query times before/after indexes"
echo "4. Monitor memory usage and connection pool"
echo ""
echo "For Vercel/Next.js optimizations:"
echo "- HTTP/2 is automatically enabled on Vercel Pro"
echo "- Code splitting is already configured in next.config.js"
echo "- Monitor bundle sizes at: https://vercel.com/[your-team]/[your-project]/analytics"