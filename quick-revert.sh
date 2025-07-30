#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Execute the revert immediately
echo "🔄 Reverting to last working build: 94d78ab"

# Save current work
git stash push -m "Backup failed fixes - $(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

# Revert to the working commit
git reset --hard 94d78ab

echo "✅ Reverted successfully!"
echo ""
echo "Current commit:"
git log -1 --oneline
echo ""
echo "To deploy this working version:"
echo "git push --force origin main"
