#!/bin/bash

echo "🔧 ClubOSV1 User Management Fix"
echo "==============================="
echo ""

# Navigate to the project directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Step 1: Install bcryptjs if needed
echo "📦 Checking dependencies..."
cd ClubOSV1-backend
if ! npm list bcryptjs > /dev/null 2>&1; then
    echo "Installing bcryptjs..."
    npm install bcryptjs
fi

# Step 2: Run the admin setup script
echo ""
echo "🔑 Setting up admin user..."
cd ..
node setup-admin.js

# Step 3: Test the authentication system
echo ""
echo "🧪 Testing authentication system..."
cd test-scripts
node test-auth-simple.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "You can now:"
echo "1. Login with admin@clubhouse247golf.com / Admin123!@#"
echo "2. Create new users through the Operations Dashboard"
echo "3. The 'failed to create user' error should be resolved"
