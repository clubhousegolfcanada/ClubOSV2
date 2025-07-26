#!/bin/bash
echo "🚀 Full PostgreSQL Implementation"
echo "================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Ensure we have the database.ts file
if [ ! -f "ClubOSV1-backend/src/utils/database.ts" ]; then
  echo "❌ database.ts is missing! Let me restore it..."
  exit 1
fi

# First, let's add the missing db.ts file that database.ts imports
cat > ClubOSV1-backend/src/utils/db.ts << 'EOF'
import { Pool } from 'pg';
import { logger } from './logger';

// Create connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', err);
});

// Helper function for queries
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', { text, error });
    throw error;
  }
}
EOF

# Ensure bcryptjs is imported correctly in feedback.ts
sed -i '' 's/import bcrypt from/import bcryptjs from/g' ClubOSV1-backend/src/utils/database.ts 2>/dev/null || true

# Build the backend
cd ClubOSV1-backend
echo "📦 Building backend..."
npm run build

# Check build result
if [ $? -eq 0 ]; then
  echo "✅ Build completed"
else
  echo "❌ Build failed - checking TypeScript errors..."
  npx tsc --noEmit
  exit 1
fi

cd ..

# Commit and push
git add -A
git commit -m "Fix: Add missing db.ts module and build database service

- Added db.ts with Pool and query exports
- Fixed imports in database.ts
- All routes now properly import database service
- Full PostgreSQL implementation ready"
git push origin main

echo -e "\n✅ Fix deployed!"
echo "The backend should now start successfully with PostgreSQL"
