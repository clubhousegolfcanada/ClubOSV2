# OpenPhone Webhook Structure (v3 API)

## Message Structure

All webhook events follow this structure:
```json
{
  "object": {
    "id": "EVxxxxx",
    "object": "event",
    "createdAt": "2025-07-30T23:21:06.178Z",
    "apiVersion": "v3",
    "type": "message.received|message.delivered",
    "data": {
      "object": {
        // Message data here
      }
    }
  }
}
```

## Incoming Message (message.received)
```json
{
  "type": "message.received",
  "data": {
    "object": {
      "from": "+19029213930",      // Customer's phone (extract this)
      "to": "+19027073748",        // Your OpenPhone number
      "direction": "incoming",
      "body": "Message content",
      "conversationId": "CNxxxxx"
    }
  }
}
```

## Outgoing Message (message.delivered)
```json
{
  "type": "message.delivered",
  "data": {
    "object": {
      "from": "+19027073748",      // Your OpenPhone number
      "to": "+16136211740",        // Customer's phone (extract this)
      "direction": "outgoing",
      "body": "Message content",
      "conversationId": "CNxxxxx"
    }
  }
}
```

## Phone Number Extraction Logic

```typescript
// For customer phone number:
if (direction === 'incoming') {
  customerPhone = message.from;  // Customer sent the message
} else {
  customerPhone = message.to;    // You sent to customer
}
```

## Key Fields
- `from`: Always the sender's phone number
- `to`: Always the recipient's phone number (string, not array)
- `body`: The message content (not `text`)
- `direction`: "incoming" or "outgoing"
- `conversationId`: OpenPhone's conversation ID
- `status`: Message status (received, delivered, etc.)