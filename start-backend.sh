#!/bin/bash

echo "🚀 Starting ClubOSV1 Backend Server"
echo "=================================="
echo ""

# Navigate to backend directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created. Please edit it to add your API keys."
    else
        # Create a basic .env file
        cat > .env << EOF
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
OPENAI_API_KEY=your-openai-api-key
SLACK_WEBHOOK_URL=your-slack-webhook-url
EOF
        echo "✅ Basic .env file created. Please add your API keys."
    fi
fi

echo ""
echo "🔧 Starting backend server on port 3001..."
echo "Press Ctrl+C to stop the server"
echo ""

# Start the backend
npm run dev
