#!/bin/bash

echo "🗑️ Adding clear feedback functionality..."

# Add all changes
git add -A

# Commit
git commit -m "Add clear feedback button to Operations page

- Add Clear All button with trash icon to feedback section
- Implement DELETE /api/feedback/clear endpoint (admin only)
- Confirm before clearing to prevent accidental deletion
- Update UI to show empty state after clearing
- Log admin actions for audit trail"

# Push
git push origin main

echo "✅ Deployed! Admins can now:"
echo "  - View not helpful feedback in Operations > Feedback Log"
echo "  - Export feedback for Claude analysis"
echo "  - Clear all feedback with confirmation prompt"
echo "  - See audit logs of who cleared feedback"
