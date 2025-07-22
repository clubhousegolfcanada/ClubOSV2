#!/bin/bash

echo "🧪 Testing ClubOSV1 Backend Endpoints"
echo "===================================="
echo ""

# Test health endpoint
echo "1️⃣ Testing health endpoint..."
curl -s http://localhost:3001/health | jq . || echo "❌ Health check failed"

echo ""
echo "2️⃣ Testing login endpoint with curl..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clubhouse247golf.com","password":"ClubhouseAdmin123!"}' \
  -v 2>&1 | grep -E "(< HTTP|{|error)"

echo ""
echo "3️⃣ Testing if backend routes are set up..."
curl -s http://localhost:3001/api/auth/login 2>&1

echo ""
echo "Check the backend terminal window for error messages!"
