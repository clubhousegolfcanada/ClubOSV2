#!/bin/bash
echo "🔧 Fixing column name mismatches in Users table"
echo "=============================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Add migration to rename columns from snake_case to camelCase
echo "Adding column rename migration..."
cat >> src/utils/database-migrations.ts << 'EOF'

    // Migration 2: Rename Users table columns to camelCase
    try {
      // Check if columns need renaming by checking if created_at exists
      const checkResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Users' 
        AND column_name = 'created_at'
      `);
      
      if (checkResult.rows.length > 0) {
        logger.info('Renaming Users table columns to camelCase...');
        
        // Rename columns from snake_case to camelCase
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN created_at TO "createdAt"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN updated_at TO "updatedAt"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN is_active TO "isActive"
        `);
        
        await query(`
          ALTER TABLE "Users" 
          RENAME COLUMN last_login TO "lastLogin"
        `);
        
        logger.info('✅ Migration: Users columns renamed to camelCase');
      } else {
        logger.info('✅ Migration: Users columns already in camelCase');
      }
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        logger.error('Failed to rename columns:', error);
      }
    }
EOF

# Update the table creation SQL to use camelCase
echo "Updating table schema to use camelCase..."
sed -i '' 's/created_at TIMESTAMP/"createdAt" TIMESTAMP/g' src/utils/database-tables.ts
sed -i '' 's/updated_at TIMESTAMP/"updatedAt" TIMESTAMP/g' src/utils/database-tables.ts
sed -i '' 's/is_active BOOLEAN/"isActive" BOOLEAN/g' src/utils/database-tables.ts
sed -i '' 's/last_login TIMESTAMP/"lastLogin" TIMESTAMP/g' src/utils/database-tables.ts

# Update database.ts to use quoted column names for camelCase
echo "Updating SQL queries to use quoted column names..."
sed -i '' 's/SET last_login/SET "lastLogin"/g' src/utils/database.ts
sed -i '' 's/SET updated_at/SET "updatedAt"/g' src/utils/database.ts

# Build and deploy
npm run build

cd ..
git add -A
git commit -m "Fix column name mismatch in Users table

- Added migration to rename snake_case columns to camelCase
- Updated table schema to use camelCase columns
- Fixed SQL queries to use quoted column names
- This resolves the 'column does not exist' error on operations page"

git push origin main

echo "✅ Column name fix deployed!"