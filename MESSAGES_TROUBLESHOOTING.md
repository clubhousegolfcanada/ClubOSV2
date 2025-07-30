# Messages Feature Troubleshooting Guide

## Quick Checklist

### ✅ Environment Variables (Backend)
- [ ] `OPENPHONE_API_KEY` - Your OpenPhone API key
- [ ] `OPENPHONE_DEFAULT_NUMBER` - Your OpenPhone number (e.g., +19027073748)
- [ ] `OPENPHONE_WEBHOOK_SECRET` - (Optional) For webhook verification

### ✅ Database Migration
Run this on your production database:
```sql
-- Check if migration is needed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'openphone_conversations' 
AND column_name IN ('unread_count', 'last_read_at');

-- If empty, run the migration at:
-- ClubOSV1-backend/src/database/migrations/017_openphone_messages_enhancement.sql
```

Or use the script:
```bash
cd ClubOSV1-backend
tsx src/scripts/apply-messages-migration.ts
```

### ✅ Test the API
```bash
cd ClubOSV1-backend
tsx src/scripts/test-messages.ts
```

### ✅ Verify Setup
```bash
cd ClubOSV1-backend
tsx src/scripts/verify-messages.ts
```

## Common Issues

### "Failed to load conversations"
1. **Check browser console** for specific error
2. **Verify auth token** exists in localStorage
3. **Check network tab** for API response
4. **Ensure backend is deployed** with new routes

### "No from number configured"
- Set `OPENPHONE_DEFAULT_NUMBER` in backend .env
- Format: `+1234567890` (with country code)

### "Messages API not found" (404)
- Backend may not have deployed latest changes
- Check if `/api/messages` routes are registered

### No messages showing
1. **Send a test SMS** to your OpenPhone number
2. **Check webhook configuration** in OpenPhone dashboard
3. **Verify webhook URL**: `https://your-api.com/api/openphone/webhook`

## Debug Steps

1. **Check backend logs** for any errors
2. **Test OpenPhone connection**:
   ```bash
   curl -H "Authorization: Bearer YOUR_OPENPHONE_API_KEY" \
        https://api.openphone.com/v1/phone-numbers
   ```

3. **Check if conversations exist**:
   ```sql
   SELECT COUNT(*) FROM openphone_conversations;
   ```

4. **View webhook logs** in OpenPhone dashboard

## Quick Test

1. Navigate to `/messages` in ClubOS
2. Send an SMS to your OpenPhone number
3. Wait 10 seconds (auto-refresh interval)
4. Message should appear in conversations list

## Contact Support

If issues persist after checking all above:
1. Check Railway/Vercel deployment logs
2. Verify all environment variables are set
3. Run the verification script and share output