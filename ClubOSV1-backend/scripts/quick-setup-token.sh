#!/bin/bash

# Quick setup script for UniFi Access token
echo "🔑 Configuring UniFi Access with your new token..."

# Add the token to .env
cat >> .env << EOF

# UniFi Access Developer API Token
UNIFI_ACCESS_TOKEN=frH9pExaQdDeA/jIQiHEfQ
UNIFI_DEVELOPER_TOKEN=frH9pExaQdDeA/jIQiHEfQ
UNIFI_CONTROLLER_IP=192.168.1.1
UNIFI_API_PORT=12445
EOF

echo "✅ Token configured!"
echo ""
echo "🚀 Now test it with:"
echo "   npm run test:session"
echo ""
echo "This will verify the token works and show your doors!"