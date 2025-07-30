#!/bin/bash
# Trigger frontend redeployment after revert

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🚀 Triggering Frontend Redeployment"
echo "==================================="

# First, ensure we're on the reverted commit
echo "📍 Current commit:"
git log -1 --oneline

echo ""
echo "📤 Pushing to GitHub to trigger Vercel deployment..."

# Force push to update GitHub and trigger Vercel
git push --force origin main

echo ""
echo "✅ Pushed to GitHub!"
echo ""
echo "🔄 Vercel should now be building..."
echo ""
echo "📋 Next steps:"
echo "1. Check Vercel dashboard: https://vercel.com/dashboard"
echo "2. Look for the new deployment in progress"
echo "3. It should show commit 94d78ab building"
echo ""
echo "Alternative options if deployment doesn't start:"
echo "- Go to Vercel dashboard and click 'Redeploy' on the last successful build"
echo "- Or make a small change (like updating version in package.json) and push again"
