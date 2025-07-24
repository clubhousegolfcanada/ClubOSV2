#!/bin/bash

echo "🧹 Cleaning Corrupted JSON Files"
echo "================================"
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Clean up all log files
echo "Resetting log files..."

# Create logs directory if it doesn't exist
mkdir -p src/data/logs

# Reset all JSON log files to empty arrays
echo "[]" > src/data/logs/requests.json
echo "[]" > src/data/authLogs.json
echo "[]" > src/data/userLogs.json
echo "[]" > src/data/accessLogs.json

echo "✅ Log files cleaned"
echo ""
echo "The backend should stop crashing now."
