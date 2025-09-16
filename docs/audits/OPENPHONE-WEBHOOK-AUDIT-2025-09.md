# OpenPhone Webhook Integration Audit
Date: September 16, 2025

## Executive Summary
The OpenPhone webhook integration is configured but messages are not appearing in ClubOS. After thorough investigation, I've identified the root causes and architecture issues.

## Current Architecture

### 1. Database Structure
- **Primary table**: `openphone_conversations` - Stores conversations with messages as JSONB
- **Secondary table**: `messages` - Stores individual messages (used for sending)
- **Issue**: Dual-table approach creates confusion about source of truth

### 2. Webhook Endpoints
Three webhook endpoints exist:
- `/api/openphone/webhook` - Main webhook handler
- `/api/openphone/webhook-debug` - Debug endpoint for raw data capture
- `/api/openphone-v3/webhook-v3` - V3 format handler for wrapped payloads

### 3. Message Flow
1. OpenPhone sends webhook to `/api/openphone/webhook`
2. Handler processes and stores in `openphone_conversations` table
3. Frontend reads from `/api/messages/conversations` which queries `openphone_conversations`
4. Sending messages uses both tables inconsistently

## Key Findings

### 1. Backend URL Issue (CRITICAL)
```bash
curl https://clubos-backend-production.up.railway.app/api/openphone/webhook
{"status":"error","code":404,"message":"Application not found"}
```
**The backend URL is returning 404 - the Railway deployment may have changed URLs or is down**

### 2. Webhook Structure Changes
OpenPhone has changed their webhook format multiple times:
- V2: Direct `{type, data}` structure
- V3: Wrapped `{object: {type, data}}` structure
- Current code attempts to handle both but may miss edge cases

### 3. Signature Verification Disabled
```typescript
// TEMPORARILY DISABLED for debugging - OpenPhone might not be sending signatures correctly
// return res.status(401).json({ error: 'Invalid signature' });
```
Signature verification is commented out, creating a security vulnerability.

### 4. Message Storage Fragmentation
Messages are stored in multiple places:
- `openphone_conversations.messages` (JSONB array)
- `messages` table (individual rows)
- `conversation_messages` table (for pattern learning)

### 5. Missing INSERT INTO messages
The webhook handler updates `openphone_conversations` but never inserts into the `messages` table that the frontend might be expecting.

## Root Causes

1. **Backend Deployment Issue**: The production backend URL is returning 404, so webhooks can't reach the application
2. **Database Inconsistency**: Messages stored in `openphone_conversations` but frontend may expect them in `messages` table
3. **Webhook Format Mismatch**: OpenPhone may have changed their format again and current handlers don't match
4. **No Error Visibility**: Webhook failures are silent - no alerts or logging visible to operators

## Verification Steps Needed

1. Check Railway deployment status:
   ```bash
   railway status
   railway logs
   ```

2. Verify current backend URL:
   ```bash
   railway variables | grep RAILWAY_PUBLIC_DOMAIN
   ```

3. Check OpenPhone webhook configuration in their dashboard:
   - Login to OpenPhone
   - Go to Settings → Integrations → Webhooks
   - Verify webhook URL matches current backend

4. Test webhook manually with correct URL:
   ```bash
   curl -X POST [CORRECT_BACKEND_URL]/api/openphone/webhook \
     -H "Content-Type: application/json" \
     -d '{"type": "message.created", "data": {...}}'
   ```

## Recommended Fixes

### Immediate Actions
1. **Fix Backend Deployment**
   - Check Railway deployment status
   - Update webhook URL in OpenPhone dashboard if changed
   - Verify environment variables are set correctly

2. **Add Webhook Monitoring**
   - Create health check endpoint for webhook status
   - Add webhook failure alerts to Slack
   - Log all webhook attempts to dedicated table

3. **Consolidate Message Storage**
   - Choose single source of truth (recommend `messages` table)
   - Migrate existing data from `openphone_conversations`
   - Update all code to use consistent storage

### Long-term Improvements
1. **Webhook Resilience**
   - Add webhook retry queue
   - Store raw webhook payloads for replay
   - Implement webhook signature verification properly

2. **Better Observability**
   - Add webhook dashboard showing success/failure rates
   - Real-time webhook debugging interface
   - Automated tests for webhook processing

3. **Database Cleanup**
   - Remove duplicate storage mechanisms
   - Create proper indexes for message queries
   - Implement message archival for old conversations

## Testing Checklist
- [ ] Verify backend is accessible at production URL
- [ ] Check OpenPhone webhook URL configuration
- [ ] Send test webhook to debug endpoint
- [ ] Verify messages appear in database
- [ ] Confirm messages show in frontend
- [ ] Test bidirectional message flow
- [ ] Verify webhook signature validation
- [ ] Check error logging and alerts

## Previous Fix Attempts
Based on git history, there have been multiple attempts to fix this:
1. Disabled signature verification for debugging
2. Added support for V3 webhook format
3. Fixed webhook handler for GET requests
4. Multiple attempts at handling wrapped payloads

Each fix addressed symptoms but not the root cause of backend unavailability.

## Conclusion
The primary issue is that the backend deployment appears to be down or has moved to a different URL. Until the backend is accessible, no webhooks can be processed. Once the backend is restored, the secondary issues of message storage consistency and webhook format handling need to be addressed.