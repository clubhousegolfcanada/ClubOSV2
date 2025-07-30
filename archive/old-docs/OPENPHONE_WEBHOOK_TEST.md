# OpenPhone Webhook Testing Guide

## 🔍 Debugging Steps

### 1. Check Railway Logs
Look for these log messages:
- `"OPENPHONE WEBHOOK:"` - Shows the full webhook data
- `"OpenPhone webhook received"` - Confirms webhook hit the endpoint
- Any error messages

### 2. Check Database Contents
Visit this URL in your browser (replace with your Railway backend URL):
```
https://your-backend.railway.app/api/openphone/debug/all
```

This will show:
- Total OpenPhone conversations in database
- Recent webhook data received

### 3. Test Webhook Manually
You can test the webhook with curl:

```bash
# Test message received webhook
curl -X POST https://your-backend.railway.app/api/openphone/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "data": {
      "phoneNumber": "+1234567890",
      "from": "+1234567890",
      "to": "+0987654321",
      "contactName": "Test Customer",
      "userName": "Test Employee",
      "body": "Test message from OpenPhone",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'

# Test call completed webhook
curl -X POST https://your-backend.railway.app/api/openphone/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.completed",
    "data": {
      "phoneNumber": "+1234567890",
      "contactName": "Test Customer",
      "userName": "Test Employee",
      "duration": 300,
      "direction": "inbound",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

### 4. Common Issues

#### Webhook Not Reaching Server
- Check OpenPhone webhook URL is exactly: `https://your-backend.railway.app/api/openphone/webhook`
- Ensure no trailing slash
- Check Railway deployment is successful

#### Signature Verification Failing
- Make sure `OPENPHONE_WEBHOOK_SECRET` in Railway matches OpenPhone dashboard
- The secret should be copied exactly with no extra spaces

#### Data Not Showing in UI
1. First verify data is in database using debug endpoint
2. Check browser console for errors
3. Make sure you're logged in as admin role

### 5. Check Statistics Error
The "Failed to load statistics" error happens when:
- No extracted_knowledge table exists yet
- No data has been extracted yet

To fix:
1. First get some OpenPhone data in the database
2. Then use the "Extract Knowledge" button in the UI
3. Statistics should then load

### 6. Manual Database Check (Railway)
You can also check the database directly in Railway:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('openphone_conversations', 'extracted_knowledge');

-- Count OpenPhone conversations
SELECT COUNT(*) FROM openphone_conversations;

-- See recent conversations
SELECT * FROM openphone_conversations 
ORDER BY created_at DESC LIMIT 10;

-- Check extracted knowledge
SELECT COUNT(*) FROM extracted_knowledge;
```

## 🚀 Next Steps

1. **If webhooks are working but UI shows no data:**
   - Click "Extract Knowledge" button to process conversations
   - This will populate the extracted_knowledge table
   - Then statistics should load

2. **If webhooks are not being received:**
   - Double-check webhook URL in OpenPhone
   - Verify webhook secret matches
   - Test with curl commands above

3. **If database is empty:**
   - Use "Import Last 30 Days" button in UI
   - This will fetch historical data from OpenPhone API