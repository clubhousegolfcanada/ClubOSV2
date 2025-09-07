#!/bin/bash

echo "========================================"
echo "Implementing Parallel Routing Strategy"
echo "========================================"
echo ""

# Step 1: Comment out the problematic debug route import
echo "Step 1: Fixing debug route import issue..."
sed -i '' 's/^import debugRoutes/\/\/ import debugRoutes/' ClubOSV1-backend/src/index.ts
sed -i '' "s/app\.use\('\/api\/debug', debugRoutes\)/\/\/ app.use\('\/api\/debug', debugRoutes\)/" ClubOSV1-backend/src/index.ts

# Step 2: Add the refactored route imports after the last import
echo "Step 2: Adding refactored route imports..."
cat >> ClubOSV1-backend/src/index.ts.tmp << 'EOF'

// Import route configuration for migration
import ROUTE_CONFIG from './config/routeConfig';

// Import refactored routes
import authRefactoredRoutes from './routes/auth-refactored';
import healthRefactoredRoutes from './routes/health-refactored';
import usersRefactoredRoutes from './routes/users-refactored';
EOF

# Step 3: Add parallel routing code after the auth routes
echo "Step 3: Adding parallel routing configuration..."
cat >> ClubOSV1-backend/src/parallel-routes.txt << 'EOF'

// PARALLEL ROUTING STRATEGY - Run both v1 and v2 during migration
// V2 Routes (refactored - mount in parallel)
if (ROUTE_CONFIG.parallelMode) {
  app.use('/api/v2/auth', authRefactoredRoutes);
  app.use('/api/v2/health', healthRefactoredRoutes);
  app.use('/api/v2/users', authenticate, usersRefactoredRoutes);
  
  logger.info('🚀 Refactored routes mounted on /api/v2/* in parallel mode');
  logger.info(`Migration status - Auth: ${ROUTE_CONFIG.useRefactoredAuth}, Health: ${ROUTE_CONFIG.useRefactoredHealth}, Users: ${ROUTE_CONFIG.useRefactoredUsers}`);
}

// Version discovery endpoint
app.get('/api/version', (req, res) => {
  res.json({
    current: ROUTE_CONFIG.apiVersion,
    available: ['v1', 'v2'],
    refactored: {
      auth: ROUTE_CONFIG.useRefactoredAuth,
      health: ROUTE_CONFIG.useRefactoredHealth,
      users: ROUTE_CONFIG.useRefactoredUsers
    },
    parallelMode: ROUTE_CONFIG.parallelMode,
    rolloutPercentage: ROUTE_CONFIG.rolloutPercentage
  });
});
EOF

echo ""
echo "========================================"
echo "Implementation Notes:"
echo "========================================"
echo ""
echo "Due to file modification conflicts, please manually add the following:"
echo ""
echo "1. At the end of the import section in index.ts, add:"
echo "   - import ROUTE_CONFIG from './config/routeConfig';"
echo "   - import authRefactoredRoutes from './routes/auth-refactored';"
echo "   - import healthRefactoredRoutes from './routes/health-refactored';"
echo "   - import usersRefactoredRoutes from './routes/users-refactored';"
echo ""
echo "2. After the line: app.use('/api/auth', authRoutes);"
echo "   Add the contents of ClubOSV1-backend/src/parallel-routes.txt"
echo ""
echo "3. Comment out or remove the debug route import and usage if it doesn't exist"
echo ""
echo "The configuration file has been created at:"
echo "  ClubOSV1-backend/src/config/routeConfig.ts"
echo ""
echo "Test script available at:"
echo "  scripts/test-parallel-routes.sh"
echo ""
echo "========================================"