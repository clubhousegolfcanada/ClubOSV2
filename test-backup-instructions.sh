#!/bin/bash

# Make the test script executable
chmod +x test-backup-restore.js

echo "🔧 ClubOS Backup/Restore Test Script Setup"
echo "========================================="
echo ""
echo "To test the backup/restore functionality:"
echo ""
echo "1. First, get your admin token by logging in:"
echo "   - Go to http://localhost:3000/login"
echo "   - Login with admin credentials"
echo "   - Open browser DevTools > Console"
echo "   - Run: localStorage.getItem('clubos_token')"
echo "   - Copy the token value"
echo ""
echo "2. Set the token as environment variable:"
echo "   export CLUBOS_TOKEN='your-token-here'"
echo ""
echo "3. Run the test:"
echo "   ./test-backup-restore.js"
echo ""
echo "Or use the UI:"
echo "   - Go to http://localhost:3000/operations"
echo "   - Click 'Backup' to download system backup"
echo "   - Click 'Restore' and select a backup file to restore"
echo ""
