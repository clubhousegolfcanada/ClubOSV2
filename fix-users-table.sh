#!/bin/bash
echo "🔧 Fixing Users table - Adding missing last_login column"
echo "===================================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Create a migration to add the missing column
echo "Creating migration to add last_login column..."
cat > src/scripts/add-last-login-column.ts << 'EOF'
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function addLastLoginColumn() {
  try {
    logger.info('Adding last_login column to Users table...');
    
    // Initialize database
    await db.initialize();
    
    // Add the column if it doesn't exist
    await db.query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
    `);
    
    logger.info('✅ last_login column added successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to add last_login column:', error);
    process.exit(1);
  }
}

addLastLoginColumn();
EOF

# Run the migration
echo "Running migration..."
npx ts-node src/scripts/add-last-login-column.ts

# Also update the database-tables.ts to ensure the column is in the schema
echo "Updating database schema..."
sed -i '' '/is_active BOOLEAN DEFAULT true,/a\
      last_login TIMESTAMP,' src/utils/database-tables.ts

# Remove the migration script after running
rm src/scripts/add-last-login-column.ts

# Commit and push
cd ..
git add -A
git commit -m "Fix Users table - add missing last_login column

- Added migration to add last_login column to existing Users table
- Updated database schema to include last_login in table creation
- This fixes the login error about missing column"

git push origin main

echo "✅ Fix deployed! The login should work now."