#!/bin/bash
# Direct revert to last working build

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔄 Reverting to last working build..."

# Show last few commits with dates
echo ""
echo "Recent commits:"
git log --oneline --date=short --pretty=format:"%h %ad %s" -5

# The Vercel error showed commit bc68262, so let's revert to before our changes
echo ""
echo "⚠️  This will DISCARD all recent changes!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Option 1: Reset to the last known working state
# Since we made changes that broke the build, go back before those changes

# First, save any uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "💾 Saving uncommitted changes..."
    git stash save "Backup before revert - $(date)"
fi

# Reset to origin/main (the last pushed working version)
echo ""
echo "🔄 Resetting to origin/main..."
git fetch origin
git reset --hard origin/main

echo ""
echo "✅ Reverted to last working build"
echo ""
echo "Current commit:"
git log -1 --oneline

echo ""
echo "📋 Next steps:"
echo "1. Verify the build works: cd ClubOSV1-frontend && npm run build"
echo "2. If you need the changes we tried, check: git stash list"
echo "3. The backup branch contains our attempted fixes"
