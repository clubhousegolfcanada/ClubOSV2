#!/bin/bash

echo "🔍 Checking ClubOSV1 Backend Configuration"
echo "========================================="
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check if .env file exists
echo "1️⃣ Checking .env file..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo ""
    echo "Current .env contents (sensitive data hidden):"
    echo "---------------------------------------------"
    cat .env | sed 's/=.*/=***/' | grep -E "(PORT|JWT_SECRET|NODE_ENV)"
else
    echo "❌ .env file missing!"
    echo "Creating basic .env file..."
    
    cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production
OPENAI_API_KEY=your-openai-api-key
SLACK_WEBHOOK_URL=your-slack-webhook-url
FRONTEND_URL=http://localhost:3000
EOF
    
    echo "✅ Created .env file"
fi

echo ""
echo "2️⃣ Checking data directory..."
if [ -d "src/data" ]; then
    echo "✅ Data directory exists"
    
    # Check if users.json exists
    if [ -f "src/data/users.json" ]; then
        echo "✅ users.json exists"
    else
        echo "❌ users.json missing"
    fi
else
    echo "❌ Data directory missing"
    mkdir -p src/data
    echo "✅ Created data directory"
fi

echo ""
echo "3️⃣ Checking node_modules..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
    
    # Check for critical packages
    for package in express bcryptjs jsonwebtoken cors; do
        if [ -d "node_modules/$package" ]; then
            echo "  ✅ $package installed"
        else
            echo "  ❌ $package missing"
        fi
    done
else
    echo "❌ node_modules missing - run: npm install"
fi

echo ""
echo "4️⃣ Checking TypeScript build..."
if [ -d "dist" ]; then
    echo "✅ dist directory exists"
else
    echo "⚠️  No dist directory - backend might be running in dev mode (tsx)"
fi

echo ""
echo "If backend is crashing, try:"
echo "1. Stop the backend (Ctrl+C)"
echo "2. Run: npm install"
echo "3. Run: npm run dev"
echo ""
echo "Check the backend terminal for error messages!"
