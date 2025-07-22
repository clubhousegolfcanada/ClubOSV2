#!/bin/bash

echo "🔧 Fixing Technical Debt in ClubOSV1"
echo "==================================="
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# 1. Install async-mutex for file locking
echo "1️⃣ Installing async-mutex for thread-safe file operations..."
npm install async-mutex

# 2. Backup current fileUtils
echo ""
echo "2️⃣ Backing up current fileUtils..."
cp src/utils/fileUtils.ts src/utils/fileUtils.backup.ts

# 3. Replace with new implementation
echo ""
echo "3️⃣ Updating fileUtils with thread-safe implementation..."
mv src/utils/fileUtils.new.ts src/utils/fileUtils.ts

# 4. Clean up corrupted files one more time
echo ""
echo "4️⃣ Cleaning up log files..."
mkdir -p src/data/logs
echo "[]" > src/data/logs/requests.json
echo "[]" > src/data/authLogs.json
echo "[]" > src/data/userLogs.json

echo ""
echo "✅ Technical debt fixes applied!"
echo ""
echo "Improvements:"
echo "- Thread-safe file operations using mutexes"
echo "- Atomic writes using temporary files"
echo "- Automatic corruption recovery"
echo "- Log size limits (max 10,000 entries)"
echo ""
echo "Restart the backend to apply changes."
