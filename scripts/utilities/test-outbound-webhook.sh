#!/bin/bash

# Test webhook for outbound message (message.sent)
# This simulates what OpenPhone sends when you send a message from their app

echo "Testing outbound message webhook (message.sent)..."

curl -X POST http://localhost:3000/api/openphone/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.sent",
    "data": {
      "id": "msg_test_sent_'$(date +%s)'",
      "from": "+19025551234",
      "to": "+19025559876",
      "body": "This is a test outbound message sent from OpenPhone",
      "direction": "outgoing",
      "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "conversationId": "conv_test_123"
    }
  }'

echo ""
echo "Response received."