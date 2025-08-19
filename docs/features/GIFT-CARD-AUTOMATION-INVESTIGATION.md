# Gift Card Automation Investigation Results

## The Problem
When you sent "do we sell gift cards" to the chat line, it failed with a database error instead of auto-responding.

## Root Cause
**Column name mismatch**: The code was querying `active = true` but the database column is named `is_active`.

## What Happened Step by Step

1. **Message Received**: "+19024783209" sent "do we sell gift cards" to "+19027073748"

2. **AI Automation Attempted**: 
   - The system correctly identified this as a gift card inquiry
   - LLM analysis was triggered (now that it's enabled)
   - System tried to send automated response

3. **Push Notification Failed**:
   - When trying to notify staff of the new message
   - Query failed: `SELECT id FROM users WHERE role IN ('admin', 'operator', 'support') AND active = true`
   - Error: column "active" does not exist (should be "is_active")

4. **Automation Blocked**:
   - Because the push notification query failed, the entire webhook processing failed
   - The automated gift card response was never sent

## Why It Never Worked Before

This reveals TWO separate issues that prevented automation:

1. **Timing Issue** (fixed earlier): AssistantService loaded before Railway env vars
2. **Database Column Issue** (just fixed): Wrong column name in queries

Even if the LLM had been working, the automation would have failed due to the database error when sending push notifications.

## Files Fixed

1. `/src/routes/openphone.ts` - Fixed 2 occurrences of `active` → `is_active`
2. `/src/services/notificationService.ts` - Fixed 1 occurrence of `active` → `is_active`

## Current Status

With both fixes deployed:
- LLM will analyze incoming messages
- Push notifications won't crash the webhook
- Gift card inquiries should get automated responses

## Test Again
Send another message asking about gift cards. It should now:
1. Analyze with GPT-4o-mini
2. Detect gift card intent
3. Query the Booking & Access assistant
4. Send automated response
5. Successfully notify staff (without crashing)