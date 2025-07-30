#!/bin/bash
# Revert to last working build

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔄 Reverting to last working build..."
echo "===================================="

# Show recent commits
echo ""
echo "📋 Recent commits:"
git log --oneline -10

echo ""
echo "📊 Current status:"
git status --short

# Based on the error messages, the last working commit was likely before we started making changes
# The Vercel build shows commit bc68262 was attempted

echo ""
echo "🎯 Options to revert:"
echo "1. Revert to specific commit (recommended if you know the last working commit)"
echo "2. Reset all uncommitted changes"
echo "3. Revert the last commit"
echo ""

# Save current changes as a backup branch
echo "💾 First, let's save current work as a backup branch..."
git stash
git checkout -b backup-failed-fixes-$(date +%Y%m%d-%H%M%S)
git stash pop
git add -A
git commit -m "backup: save failed fix attempts"

# Go back to main branch
git checkout main

echo ""
echo "✅ Current work saved in backup branch"
echo ""
echo "Now you can:"
echo ""
echo "Option 1 - Revert to specific commit (if you know the last working one):"
echo "  git reset --hard <commit-hash>"
echo ""
echo "Option 2 - Revert to the commit before our changes:"
echo "  git reset --hard HEAD~2  # Go back 2 commits"
echo ""
echo "Option 3 - If you pushed to GitHub, reset to origin/main:"
echo "  git fetch origin"
echo "  git reset --hard origin/main"
echo ""
echo "After reverting, push with:"
echo "  git push --force origin main"
