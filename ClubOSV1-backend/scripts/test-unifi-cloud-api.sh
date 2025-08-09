#!/bin/bash

echo "========================================="
echo "UniFi Cloud API Test"
echo "========================================="
echo ""

# Your console ID from the URL
CONSOLE_ID="0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302"

echo "Testing different UniFi API endpoints..."
echo ""

# Test 1: Try the cloud API directly
echo "1. Testing UniFi Cloud API..."
curl -s -X POST https://unifi.ui.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mikebelair79","password":"M0zm3dd9u..!"}' \
  -c cookies.txt \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "2. Testing console access..."
curl -s https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/api/s/default/stat/device \
  -b cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" | head -20

echo ""
echo "3. Checking for Access API..."
curl -s https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/access/api/info \
  -b cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" | head -20

# Clean up
rm -f cookies.txt

echo ""
echo "========================================="
echo "Note: UniFi Cloud uses a proxy system"
echo "========================================="
echo ""
echo "The cloud URL structure is:"
echo "https://unifi.ui.com/proxy/consoles/[console-id]/[api-path]"
echo ""
echo "This requires:"
echo "1. Authentication with UI account"
echo "2. Session cookies"
echo "3. Custom API implementation"
echo ""
echo "The npm package 'unifi-access' doesn't support this."
echo "You need direct controller access via:"
echo "- VPN to location network"
echo "- Port forwarding"
echo "- Local access at site"
echo ""