#!/bin/bash

# Rollback to last working state

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔄 Rolling back to last stable version"
echo "======================================"

# Check recent commits
echo "Recent commits:"
git log --oneline -10

echo -e "\n⚠️  This will rollback to before our changes"
echo "The Slack messages will show admin info, but at least it will work"
echo ""
read -p "Continue with rollback? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]
then
    # Rollback to the commit before our changes
    git reset --hard 1e06447
    
    # Force push to trigger deployment
    git push origin main --force
    
    echo -e "\n✅ Rolled back successfully!"
    echo "============================"
    echo "📌 Railway will redeploy the working version"
    echo "📌 Wait 2-3 minutes for deployment"
    echo "📌 Then login and test - it should work"
    echo ""
    echo "We can try the user info fix another way later"
else
    echo "Rollback cancelled"
fi
