#!/bin/bash
# Verify local files match the deployed build

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔍 Verifying Local Files Match Deployed Build"
echo "=============================================="

# Check current commit
echo ""
echo "📍 Current local commit:"
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_SHORT=$(git rev-parse --short HEAD)
echo "   $CURRENT_SHORT - $(git log -1 --pretty=format:'%s' HEAD)"

# Check if we're on 94d78ab
echo ""
if [ "$CURRENT_SHORT" = "94d78ab" ]; then
    echo "✅ SUCCESS: Your local files match the deployed build!"
    echo "   You are on commit 94d78ab"
else
    echo "❌ MISMATCH: Your local files don't match the deployed build!"
    echo "   Local:    $CURRENT_SHORT"
    echo "   Deployed: 94d78ab"
fi

# Show status
echo ""
echo "📊 Git status:"
if [[ -z $(git status --porcelain) ]]; then
    echo "   ✅ Working directory clean (no uncommitted changes)"
else
    echo "   ⚠️  You have uncommitted changes:"
    git status --short
fi

# Show difference from deployed commit
echo ""
echo "📋 Difference from deployed build (94d78ab):"
DIFF_COUNT=$(git rev-list --count 94d78ab..HEAD 2>/dev/null || echo "unknown")
if [ "$DIFF_COUNT" = "0" ]; then
    echo "   ✅ No difference - files are identical"
elif [ "$DIFF_COUNT" = "unknown" ]; then
    echo "   ❌ Not on the same branch as 94d78ab"
else
    echo "   ⚠️  $DIFF_COUNT commits ahead of deployed version"
    echo ""
    echo "   Commits since 94d78ab:"
    git log --oneline 94d78ab..HEAD
fi

# Show how to sync if needed
if [ "$CURRENT_SHORT" != "94d78ab" ]; then
    echo ""
    echo "🔧 To sync with deployed build:"
    echo "   git reset --hard 94d78ab"
    echo ""
    echo "   This will:"
    echo "   - Reset your local files to match exactly what's deployed"
    echo "   - Discard any local changes"
fi
