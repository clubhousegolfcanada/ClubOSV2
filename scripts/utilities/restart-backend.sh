#!/bin/bash

echo "🔧 Restarting ClubOSV1 Backend with Fixes"
echo "========================================"
echo ""

# Navigate to backend directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Stop any running backend process
echo "⏹️  Stopping any running backend processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
sleep 2

# Clean up log files
echo ""
echo "🧹 Cleaning up log files..."
mkdir -p src/data/logs
echo "[]" > src/data/logs/requests.json
echo "[]" > src/data/authLogs.json
echo "[]" > src/data/userLogs.json

# Make sure .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
OPENAI_API_KEY=sk-test
SLACK_WEBHOOK_URL=https://hooks.slack.com/test
FRONTEND_URL=http://localhost:3000
EOF
fi

echo ""
echo "🚀 Starting backend server..."
echo "================================"
echo ""

# Start the backend
npm run dev
