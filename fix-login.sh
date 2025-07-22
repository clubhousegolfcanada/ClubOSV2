#!/bin/bash

echo "🔧 ClubOSV1 Login Fix Script"
echo "============================"
echo ""

# Navigate to ClubOSV1 directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Check if backend is running
echo "🔍 Checking if backend server is running..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server is not running!"
    echo "Please start it in another terminal:"
    echo "cd ClubOSV1-backend && npm run dev"
    echo ""
    echo "Press Enter when the backend is running..."
    read
fi

# Install dependencies if needed
echo ""
echo "📦 Checking dependencies..."
cd ClubOSV1-backend
if ! npm list bcryptjs > /dev/null 2>&1; then
    echo "Installing bcryptjs..."
    npm install bcryptjs
fi

if ! npm list axios > /dev/null 2>&1; then
    echo "Installing axios..."
    npm install axios
fi

# Reset admin password
echo ""
echo "🔐 Resetting admin password..."
cd ..
node reset-admin-password.js

# Test login
echo ""
echo "🧪 Testing login..."
node test-login.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "You should now be able to login with:"
echo "Email: admin@clubhouse247golf.com"
echo "Password: ClubhouseAdmin123!"
echo ""
echo "Go to http://localhost:3000/login and try logging in!"
