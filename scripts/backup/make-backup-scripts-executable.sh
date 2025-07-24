#!/bin/bash

# Make all backup-related scripts executable
chmod +x test-backup-restore.js
chmod +x verify-backup-system.js
chmod +x test-backup-instructions.sh

echo "✅ Scripts are now executable!"
echo ""
echo "Available commands:"
echo "  ./verify-backup-system.js    - Check if backup system is properly configured"
echo "  ./test-backup-restore.js     - Test backup/restore functionality (requires token)"
echo "  ./test-backup-instructions.sh - Show detailed testing instructions"
