#!/bin/bash

# Commit NinjaOne Integration
cd "$(dirname "$0")"

echo "=== Committing NinjaOne Integration ==="
echo ""

# Add all changes
echo "Adding all changes..."
git add -A

# Show what will be committed
echo ""
echo "Files to be committed:"
git status --short

# Commit with comprehensive message
echo ""
echo "Creating commit..."
git commit -m "feat: Add NinjaOne remote actions integration v1.7.0

- Implemented remote actions API endpoints with demo mode
- Added PowerShell scripts for PC/software control  
- Created Remote Actions tab in Commands page
- Added support for TrackMan, Music, TV system controls
- Implemented real-time job status polling
- Added comprehensive error handling and logging
- Created database migration for action history
- Full RBAC integration (operator role required)
- Slack notifications for critical actions
- Demo mode active until credentials configured

Backend changes:
- Added /api/remote-actions routes
- Created NinjaOne service with OAuth2
- Database migration 007_remote_actions.sql
- Support for all action types
- Device mapping for all locations

Frontend changes:
- New Remote Actions UI in Commands page
- Location-based control interface
- Real-time status updates
- Toast notifications
- API client integration

PowerShell scripts (7 total):
- Restart-TrackMan-Simple.ps1
- Restart-Browser-Simple.ps1
- Reboot-SimulatorPC.ps1
- Restart-All-Software.ps1
- Restart-MusicSystem.ps1
- Restart-TVSystem.ps1
- Other-SystemActions.ps1

Ready for production in ~45 minutes once NinjaOne subscription available."

echo ""
echo "✅ Commit created successfully!"
echo ""
echo "To push to GitHub and trigger deployments, run:"
echo "git push origin main"
