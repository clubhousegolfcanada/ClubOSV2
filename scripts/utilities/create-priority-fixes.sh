#!/bin/bash

# Priority Fix List for ClubOS
# Execute these fixes in order

echo "🔧 ClubOS Priority Fixes"
echo "======================="
echo ""

PROJECT_ROOT="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
cd "$PROJECT_ROOT"

# Create fixes directory
mkdir -p priority-fixes

# Fix 1: DATABASE_URL Validation
cat > priority-fixes/01-fix-database-validation.sh << 'SCRIPT'
#!/bin/bash
echo "Fix 1: Add DATABASE_URL validation"

cd ClubOSV1-backend/src/utils
cp envValidator.ts envValidator.ts.backup

# Add DATABASE_URL to required variables
sed -i '' '/JWT_SECRET: string;/a\
  DATABASE_URL: string;' envValidator.ts

# Already has validation rule, just needs to be in interface
echo "✅ DATABASE_URL validation fixed"
SCRIPT

# Fix 2: Re-enable Authentication
cat > priority-fixes/02-enable-authentication.sh << 'SCRIPT'
#!/bin/bash
echo "Fix 2: Re-enable authentication on LLM endpoint"

cd ClubOSV1-backend/src/routes
cp llm.ts llm.ts.backup

# Uncomment authentication middleware
sed -i '' 's|// authenticate,|authenticate,|g' llm.ts
sed -i '' 's|// roleGuard|roleGuard|g' llm.ts

echo "✅ Authentication re-enabled"
SCRIPT

# Fix 3: Fix Admin Creation Script
cat > priority-fixes/03-fix-admin-script.sh << 'SCRIPT'
#!/bin/bash
echo "Fix 3: Fix createAdmin.ts to use PostgreSQL"

cd ClubOSV1-backend/src/scripts
cat > createAdmin.ts << 'EOF'
import { db } from '../utils/database';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

async function createAdmin() {
  try {
    await db.initialize();
    
    const email = process.argv[2] || 'admin@clubhouse247golf.com';
    const password = process.argv[3] || 'ChangeMe123!';
    const name = process.argv[4] || 'Admin User';
    
    const existing = await db.findUserByEmail(email);
    if (existing) {
      logger.error(`User with email ${email} already exists`);
      process.exit(1);
    }
    
    const user = await db.createUser({
      email,
      password,
      name,
      role: 'admin'
    });
    
    logger.info('Admin user created:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to create admin:', error);
    process.exit(1);
  }
}

createAdmin();
EOF

echo "✅ Admin script fixed"
SCRIPT

# Fix 4: Update JWT Documentation
cat > priority-fixes/04-fix-jwt-docs.sh << 'SCRIPT'
#!/bin/bash
echo "Fix 4: Update JWT expiration in documentation"

# Update README
sed -i '' 's/JWT with 7-day expiration/JWT with 24-hour expiration/g' README.md

# Update other docs
find . -name "*.md" -type f | xargs sed -i '' 's/7 days/24 hours/g'
find . -name "*.md" -type f | xargs sed -i '' 's/7-day/24-hour/g'

echo "✅ JWT documentation updated"
SCRIPT

# Fix 5: Consolidate Scripts
cat > priority-fixes/05-consolidate-scripts.sh << 'SCRIPT'
#!/bin/bash
echo "Fix 5: Consolidate deployment scripts"

# Create organized script structure
mkdir -p scripts/{deployment,fixes,utilities,database}

# Move scripts to appropriate directories
mv deploy-*.sh scripts/deployment/ 2>/dev/null
mv fix-*.sh scripts/fixes/ 2>/dev/null
mv postgres-*.sh scripts/database/ 2>/dev/null
mv quick-*.sh scripts/utilities/ 2>/dev/null

# Create master deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
# Master deployment script for ClubOS

echo "🚀 ClubOS Deployment"
echo "==================="

# Build backend
cd ClubOSV1-backend
npm run build

# Commit and push
cd ..
git add -A
git commit -m "$1"
git push origin main

echo "✅ Deployment complete"
EOF

chmod +x deploy.sh
echo "✅ Scripts consolidated"
SCRIPT

# Make all fix scripts executable
chmod +x priority-fixes/*.sh

# Create master fix script
cat > run-priority-fixes.sh << 'EOF'
#!/bin/bash
echo "🚨 Running ClubOS Priority Fixes"
echo "================================"
echo ""

# Run each fix in order
for script in priority-fixes/*.sh; do
  echo "Running: $script"
  bash "$script"
  echo ""
done

echo "✅ All priority fixes completed!"
echo ""
echo "Next steps:"
echo "1. Test the fixes locally"
echo "2. Commit: git add -A && git commit -m 'Apply priority fixes for tech debt'"
echo "3. Deploy: git push origin main"
EOF

chmod +x run-priority-fixes.sh
chmod +x generate-tech-debt-report.sh

echo "✅ Priority fix scripts created!"
echo ""
echo "To generate tech debt report: ./generate-tech-debt-report.sh"
echo "To run priority fixes: ./run-priority-fixes.sh"
echo ""
echo "Current tech debt summary:"
echo "- Shell scripts: $(find . -name "*.sh" | grep -v node_modules | wc -l)"
echo "- Fix scripts: $(find . -name "fix-*.sh" | grep -v node_modules | wc -l)"
echo "- TypeScript 'any': $(grep -r "any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l) occurrences"
echo "- TODOs: $(grep -r "TODO" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)"
