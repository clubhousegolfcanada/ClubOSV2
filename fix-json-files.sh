#!/bin/bash

echo "🔧 Fixing ClubOSV1 Backend JSON Files"
echo "===================================="
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Stop the backend if it's running
echo "⚠️  Please stop the backend server (Ctrl+C) if it's running"
echo "Press Enter when ready..."
read

# Clean up corrupted JSON files
echo ""
echo "1️⃣ Cleaning up corrupted JSON files..."

# Reset request logs
if [ -f "src/data/logs/requests.json" ]; then
    echo "Resetting logs/requests.json..."
    echo "[]" > src/data/logs/requests.json
fi

# Reset all log files to empty arrays
for file in userLogs.json authLogs.json systemLogs.json accessLogs.json; do
    if [ -f "src/data/$file" ]; then
        echo "Resetting $file..."
        echo "[]" > "src/data/$file"
    fi
done

# Make sure all required JSON files exist with valid content
echo ""
echo "2️⃣ Ensuring all required JSON files exist..."

# Create data directory structure
mkdir -p src/data/logs
mkdir -p src/data/backups
mkdir -p src/data/sync

# Initialize all required JSON files
cat > src/data/userLogs.json << 'EOF'
[]
EOF

cat > src/data/bookings.json << 'EOF'
[]
EOF

cat > src/data/accessLogs.json << 'EOF'
[]
EOF

cat > src/data/authLogs.json << 'EOF'
[]
EOF

cat > src/data/systemConfig.json << 'EOF'
{
  "llmEnabled": true,
  "slackFallbackEnabled": true,
  "maxRetries": 3,
  "requestTimeout": 30000,
  "dataRetentionDays": 90
}
EOF

# Make sure users.json is valid
if [ -f "src/data/users.json" ]; then
    echo "✅ users.json exists"
else
    echo "Creating users.json..."
    cat > src/data/users.json << 'EOF'
[
  {
    "id": "admin-001",
    "email": "admin@clubhouse247golf.com",
    "password": "$2a$10$Yl9.Bh1yM5rGFnhZFQt.PORZJfmVGFT2IiW9kicuXRqzWGJzW2lbO",
    "name": "Admin User",
    "role": "admin",
    "createdAt": "2025-07-21T00:00:00.000Z",
    "updatedAt": "2025-07-21T00:00:00.000Z"
  }
]
EOF
fi

echo ""
echo "✅ All JSON files have been reset!"
echo ""
echo "3️⃣ Now restart the backend:"
echo "npm run dev"
echo ""
echo "Then try logging in again with:"
echo "Email: admin@clubhouse247golf.com"
echo "Password: ClubhouseAdmin123!"
