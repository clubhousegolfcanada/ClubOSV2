# Data Directory

This directory is for persistent data storage. When using Railway Volumes, mount a volume to this directory to persist data between deployments.

## Files stored here:
- users.json
- userLogs.json
- authLogs.json
- systemConfig.json
- feedback_logs/

## Railway Volume Setup:
1. Go to your Railway service
2. Click on "Volumes" tab
3. Create a new volume
4. Mount path: `/app/data`
5. Redeploy the service
