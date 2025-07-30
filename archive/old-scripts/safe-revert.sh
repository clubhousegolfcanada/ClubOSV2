#!/bin/bash
# Safe revert to last working build

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔍 Analyzing current state..."
echo "============================="

# Check if we have uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  You have uncommitted changes:"
    git status --short
    echo ""
fi

# Show recent commits
echo "📋 Recent commits:"
git log --oneline -5

# The safest approach is to revert to the last commit that was successfully deployed
echo ""
echo "🎯 Revert options:"
echo ""
echo "1. SAFEST - Reset to last GitHub version:"
echo "   git fetch origin && git reset --hard origin/main"
echo ""
echo "2. Undo last 2 commits (our fix attempts):"
echo "   git reset --hard HEAD~2"
echo ""
echo "3. Checkout a specific working commit:"
echo "   git reset --hard <commit-hash>"
echo ""

# Create the actual revert commands
cat > do-revert.sh << 'EOF'
#!/bin/bash
# Execute the revert

# Save current work first
echo "💾 Saving current work..."
git stash push -m "Pre-revert backup $(date +%Y%m%d-%H%M%S)"

# Reset to origin/main (last pushed version)
echo "🔄 Resetting to origin/main..."
git fetch origin
git reset --hard origin/main

echo "✅ Done! Reverted to:"
git log -1 --oneline

echo ""
echo "To recover stashed changes later: git stash list"
EOF

chmod +x do-revert.sh

echo "✅ Created do-revert.sh"
echo ""
echo "To revert, run: ./do-revert.sh"
echo ""
echo "This will:"
echo "1. Save your current changes to stash"
echo "2. Reset to the last version on GitHub"
echo "3. Show you the commit you're now on"
