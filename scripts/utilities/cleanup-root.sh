#!/bin/bash

echo "🧹 ClubOS Cleanup Script"
echo "======================="
echo ""
echo "This will clean up temporary files and scripts from the root directory."
echo "All important files will be preserved."
echo ""
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 1
fi

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

echo ""
echo "📁 Creating archive directory for old scripts..."
mkdir -p archive/deployment-scripts
mkdir -p archive/test-scripts
mkdir -p archive/fix-scripts

echo ""
echo "📦 Moving deployment scripts to archive..."
mv deploy-*.sh archive/deployment-scripts/ 2>/dev/null
mv commit-*.sh archive/deployment-scripts/ 2>/dev/null

echo ""
echo "🧪 Moving test scripts to archive..."
mv test-*.sh archive/test-scripts/ 2>/dev/null
mv test-*.js archive/test-scripts/ 2>/dev/null
mv test-*.html archive/test-scripts/ 2>/dev/null

echo ""
echo "🔧 Moving fix scripts to archive..."
mv fix-*.sh archive/fix-scripts/ 2>/dev/null
mv fix-*.js archive/fix-scripts/ 2>/dev/null
mv *-fix.sh archive/fix-scripts/ 2>/dev/null
mv *-fix.js archive/fix-scripts/ 2>/dev/null
mv emergency-*.sh archive/fix-scripts/ 2>/dev/null
mv temp-*.sh archive/fix-scripts/ 2>/dev/null

echo ""
echo "🗑️  Moving other temporary files to archive..."
mv check-*.sh archive/test-scripts/ 2>/dev/null
mv check-*.js archive/test-scripts/ 2>/dev/null
mv debug-*.js archive/test-scripts/ 2>/dev/null
mv setup-*.sh archive/deployment-scripts/ 2>/dev/null
mv setup-*.js archive/deployment-scripts/ 2>/dev/null

echo ""
echo "📄 Moving documentation to archive..."
mkdir -p archive/docs
mv *_GUIDE.md archive/docs/ 2>/dev/null
mv *_SETUP.md archive/docs/ 2>/dev/null
mv *_UPDATE.md archive/docs/ 2>/dev/null

echo ""
echo "🗑️  Removing unnecessary files..."
rm -f .DS_Store 2>/dev/null
rm -f package-lock.json 2>/dev/null  # This should be in subdirectories
rm -f *.patch 2>/dev/null

echo ""
echo "📋 Files that will remain in root:"
echo "================================="
ls -la | grep -E "(README|\.git|\.md$|ClubOSV1-|scripts/|Notes/|archive/)" | grep -v archive/

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "- Deployment scripts moved to: archive/deployment-scripts/"
echo "- Test scripts moved to: archive/test-scripts/"
echo "- Fix scripts moved to: archive/fix-scripts/"
echo "- Documentation moved to: archive/docs/"
echo ""
echo "💡 The archive directory contains all moved files if you need them later."
echo ""
echo "🎯 Next steps:"
echo "1. Review the archive directory"
echo "2. Delete archive directory when comfortable"
echo "3. Run 'git add . && git commit -m \"chore: cleanup root directory\"'"
