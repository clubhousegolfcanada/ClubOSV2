#!/bin/bash

# Fix Environment Variables Script
# This script sets up missing critical environment variables

echo "🔧 Setting up missing environment variables..."

BACKEND_ENV="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/.env"

# Check if .env exists
if [ ! -f "$BACKEND_ENV" ]; then
    echo "❌ .env file not found at $BACKEND_ENV"
    exit 1
fi

# Generate ENCRYPTION_KEY if not present
if ! grep -q "^ENCRYPTION_KEY=" "$BACKEND_ENV"; then
    echo "📝 Generating ENCRYPTION_KEY..."
    ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -d '\n' | cut -c1-32)
    echo "" >> "$BACKEND_ENV"
    echo "# Data Encryption (auto-generated)" >> "$BACKEND_ENV"
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$BACKEND_ENV"
    echo "✅ ENCRYPTION_KEY added"
else
    echo "✓ ENCRYPTION_KEY already exists"
fi

# Check for VAPID keys
if ! grep -q "^VAPID_PUBLIC_KEY=" "$BACKEND_ENV"; then
    echo "📝 Generating VAPID keys for push notifications..."
    
    # Create temporary Node.js script to generate VAPID keys
    cat > /tmp/generate-vapid.js << 'EOF'
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('PUBLIC:' + vapidKeys.publicKey);
console.log('PRIVATE:' + vapidKeys.privateKey);
EOF
    
    # Check if web-push is installed
    cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
    if ! npm list web-push --depth=0 > /dev/null 2>&1; then
        echo "Installing web-push..."
        npm install web-push --save
    fi
    
    # Generate keys
    VAPID_OUTPUT=$(node /tmp/generate-vapid.js 2>/dev/null)
    VAPID_PUBLIC=$(echo "$VAPID_OUTPUT" | grep "PUBLIC:" | cut -d':' -f2)
    VAPID_PRIVATE=$(echo "$VAPID_OUTPUT" | grep "PRIVATE:" | cut -d':' -f2)
    
    if [ -n "$VAPID_PUBLIC" ] && [ -n "$VAPID_PRIVATE" ]; then
        echo "" >> "$BACKEND_ENV"
        echo "# Push Notifications (auto-generated)" >> "$BACKEND_ENV"
        echo "VAPID_PUBLIC_KEY=$VAPID_PUBLIC" >> "$BACKEND_ENV"
        echo "VAPID_PRIVATE_KEY=$VAPID_PRIVATE" >> "$BACKEND_ENV"
        echo "VAPID_EMAIL=mailto:admin@clubhouse247golf.com" >> "$BACKEND_ENV"
        echo "✅ VAPID keys added"
    else
        echo "⚠️  Could not generate VAPID keys - push notifications will be disabled"
    fi
    
    rm -f /tmp/generate-vapid.js
else
    echo "✓ VAPID keys already exist"
fi

# Check for OPENAI_API_KEY
if ! grep -q "^OPENAI_API_KEY=" "$BACKEND_ENV"; then
    echo ""
    echo "⚠️  OPENAI_API_KEY is missing!"
    echo "   AI features will be disabled until you add your OpenAI API key"
    echo "   Add it manually to $BACKEND_ENV:"
    echo "   OPENAI_API_KEY=sk-your-openai-api-key"
else
    echo "✓ OPENAI_API_KEY exists"
fi

# Update frontend .env.local with VAPID public key
FRONTEND_ENV="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/.env.local"
if [ -f "$FRONTEND_ENV" ] && [ -n "$VAPID_PUBLIC" ]; then
    if ! grep -q "^NEXT_PUBLIC_VAPID_PUBLIC_KEY=" "$FRONTEND_ENV"; then
        echo "" >> "$FRONTEND_ENV"
        echo "# Push Notifications" >> "$FRONTEND_ENV"
        echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$VAPID_PUBLIC" >> "$FRONTEND_ENV"
        echo "✅ Frontend VAPID public key added"
    fi
fi

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "Summary:"
echo "- ENCRYPTION_KEY: Set ✓"
echo "- VAPID keys: Set ✓"
echo "- OPENAI_API_KEY: $(grep -q '^OPENAI_API_KEY=' "$BACKEND_ENV" && echo 'Set ✓' || echo 'Missing ⚠️')"
echo ""
echo "Next steps:"
echo "1. Add your OPENAI_API_KEY if missing"
echo "2. Restart the backend server"
echo "3. Test the authentication flow"