#!/bin/bash
# Revert to the last known working build: 94d78ab

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔄 Reverting to last working build: 94d78ab"
echo "==========================================="

# Show current status
echo ""
echo "📊 Current status:"
git status --short

# Save any uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo ""
    echo "💾 Saving uncommitted changes..."
    git stash push -m "Backup before reverting to 94d78ab - $(date +%Y%m%d-%H%M%S)"
    echo "✅ Changes saved to stash"
fi

# Show where we are now
echo ""
echo "📍 Current commit:"
git log -1 --oneline

# Reset to the working commit
echo ""
echo "🔄 Reverting to commit 94d78ab..."
git reset --hard 94d78ab

# Verify the revert
echo ""
echo "✅ Successfully reverted to:"
git log -1 --oneline

echo ""
echo "📋 Next steps:"
echo "1. Test the build locally:"
echo "   cd ClubOSV1-frontend && npm run build"
echo ""
echo "2. If the build works, force push to update remote:"
echo "   git push --force origin main"
echo ""
echo "3. Your attempted fixes are saved in stash:"
echo "   git stash list"
echo ""
echo "⚠️  Note: This has removed all commits after 94d78ab"
