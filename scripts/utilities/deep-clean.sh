#!/bin/bash

echo "🧹 ClubOS Deep Clean Script"
echo "==========================="
echo ""
echo "This script will:"
echo "1. Clean up log files"
echo "2. Remove .DS_Store files" 
echo "3. Clear build artifacts"
echo "4. Organize documentation"
echo "5. Remove unused files"
echo ""
read -p "Continue with deep clean? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deep clean cancelled."
    exit 1
fi

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# 1. Clean up logs
echo ""
echo "📋 Cleaning up log files..."
echo "Current log sizes:"
ls -lh ClubOSV1-backend/logs/*.log 2>/dev/null || echo "No log files found"
ls -lh ClubOSV1-backend/backend.log 2>/dev/null || echo "No backend.log found"
ls -lh ClubOSV1-frontend/frontend.log 2>/dev/null || echo "No frontend.log found"

echo ""
read -p "Delete all log files? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f ClubOSV1-backend/logs/*.log
    rm -f ClubOSV1-backend/backend.log
    rm -f ClubOSV1-frontend/frontend.log
    echo "✅ Logs cleaned"
else
    echo "⏭️  Skipping log cleanup"
fi

# 2. Remove .DS_Store files
echo ""
echo "🍎 Removing .DS_Store files..."
find . -name ".DS_Store" -type f -print -delete
echo "✅ .DS_Store files removed"

# 3. Add .DS_Store to .gitignore if not present
echo ""
echo "📝 Updating .gitignore..."
if ! grep -q ".DS_Store" .gitignore 2>/dev/null; then
    echo ".DS_Store" >> .gitignore
    echo "✅ Added .DS_Store to .gitignore"
else
    echo "✅ .DS_Store already in .gitignore"
fi

# 4. Clear build artifacts (optional)
echo ""
echo "🏗️  Build artifacts found:"
[ -d "ClubOSV1-frontend/.next" ] && du -sh ClubOSV1-frontend/.next || echo "No .next directory"
[ -d "ClubOSV1-backend/dist" ] && du -sh ClubOSV1-backend/dist || echo "No dist directory"

echo ""
read -p "Remove build artifacts? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf ClubOSV1-frontend/.next
    rm -rf ClubOSV1-backend/dist
    echo "✅ Build artifacts removed"
else
    echo "⏭️  Keeping build artifacts"
fi

# 5. Organize backend documentation
echo ""
echo "📚 Organizing backend documentation..."
if [ -d "ClubOSV1-backend" ]; then
    cd ClubOSV1-backend
    mkdir -p docs/setup docs/api docs/deployment
    
    # Move documentation files if they exist
    [ -f "ENVIRONMENT_SETUP.md" ] && mv ENVIRONMENT_SETUP.md docs/setup/ 2>/dev/null
    [ -f "GPT_ENV_CHECKLIST.md" ] && mv GPT_ENV_CHECKLIST.md docs/setup/ 2>/dev/null
    [ -f "GPT_FUNCTIONS_README.md" ] && mv GPT_FUNCTIONS_README.md docs/api/ 2>/dev/null
    [ -f "RBAC_DOCUMENTATION.md" ] && mv RBAC_DOCUMENTATION.md docs/api/ 2>/dev/null
    [ -f "STEP_4_WEBHOOK_SETUP.md" ] && mv STEP_4_WEBHOOK_SETUP.md docs/setup/ 2>/dev/null
    
    echo "✅ Backend docs organized"
    cd ..
fi

# 6. Remove unused component (RoleSwitcher)
echo ""
read -p "Remove unused RoleSwitcher component? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f ClubOSV1-frontend/src/components/RoleSwitcher.tsx
    echo "✅ Removed unused RoleSwitcher component"
else
    echo "⏭️  Keeping RoleSwitcher component"
fi

# 7. Summary
echo ""
echo "📊 Deep Clean Summary"
echo "===================="
echo "✅ Log files cleaned"
echo "✅ .DS_Store files removed" 
echo "✅ .gitignore updated"
[ -d "ClubOSV1-frontend/.next" ] || echo "✅ Frontend build artifacts removed"
[ -d "ClubOSV1-backend/dist" ] || echo "✅ Backend build artifacts removed"
echo "✅ Documentation organized"

echo ""
echo "💡 Next steps:"
echo "1. Run the root cleanup script: ./cleanup-root.sh"
echo "2. Commit changes: git add . && git commit -m 'chore: deep clean project'"
echo "3. Consider updating dependencies: npm update (in each directory)"

# Show disk usage
echo ""
echo "📊 Current disk usage:"
du -sh ClubOSV1-frontend 2>/dev/null || echo "Frontend size unknown"
du -sh ClubOSV1-backend 2>/dev/null || echo "Backend size unknown"
du -sh . 2>/dev/null || echo "Total size unknown"