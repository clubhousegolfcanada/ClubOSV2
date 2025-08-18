#!/bin/bash

echo "Waiting 2 minutes for deployment..."
sleep 120

echo -e "\nTesting production knowledge system..."
curl -X GET "https://clubos-backend-production.up.railway.app/api/test-knowledge?query=Do%20you%20offer%20gift%20cards?" \
  -H "Accept: application/json" | python3 -m json.tool

echo -e "\n\nTest complete!"
