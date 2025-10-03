#!/bin/bash

echo "Testing ticket creation locally..."

# Test ticket creation with photo
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "title": "Test Ticket with Photo",
    "description": "Testing ticket creation with photo_urls field",
    "category": "tech",
    "priority": "medium",
    "location": "Bay 1",
    "photo_urls": ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="]
  }'

echo ""
echo "Test complete. Check response above for success/error."