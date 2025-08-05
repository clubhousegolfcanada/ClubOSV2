# 📬 Push Notification Integration - OpenPhone to ClubOS

## Overview
Push notifications are fully implemented in ClubOS to alert users when new OpenPhone messages arrive. This removes the need for users to have OpenPhone installed directly.

## Current Implementation Status ✅

### 1. Database Structure
- ✅ `push_subscriptions` table exists with all required columns
- ✅ `notification_history` for tracking
- ✅ `notification_preferences` for user settings
- ✅ Device info tracking via `user_agent` column

### 2. Backend Services
- ✅ NotificationService with VAPID support
- ✅ Web Push integration
- ✅ Quiet hours support
- ✅ Failed subscription handling
- ✅ Rate limiting and retry logic

### 3. OpenPhone Integration
- ✅ Webhook handler processes incoming messages
- ✅ Sends push notifications to admin, operator, and support roles
- ✅ Includes sender name and message preview
- ✅ Deep links to `/messages` page
- ✅ Conversation ID included for direct navigation

### 4. Service Worker
- ✅ Push event handler implemented
- ✅ Notification click handling with routing
- ✅ Offline support
- ✅ Background sync capabilities

### 5. API Endpoints
- ✅ `/api/notifications/vapid-key` - Get public key
- ✅ `/api/notifications/subscribe` - Subscribe device
- ✅ `/api/notifications/subscribe` (DELETE) - Unsubscribe
- ✅ `/api/notifications/subscription-status` - Check status
- ✅ `/api/notifications/preferences` - Get/update preferences
- ✅ `/api/notifications/test` - Send test (admin only)
- ✅ `/api/notifications/history` - View history
- ✅ `/api/notifications/analytics` - Analytics dashboard

## Notification Flow

1. **OpenPhone Message Arrives**
   - Webhook hits `/api/messaging/webhook`
   - Message type: `message.created` with `direction: incoming`

2. **Process & Format**
   - Extract sender name (contact name or phone number)
   - Truncate message body to 50 chars for notification
   - Keep 100 char preview in data payload

3. **Target Users**
   - Query all users with roles: admin, operator, support
   - Check their notification preferences
   - Skip if quiet hours are active

4. **Send Push Notifications**
   ```javascript
   {
     title: 'New OpenPhone Message',
     body: 'From Mike: "Hey, door won\'t open again..."',
     icon: '/logo-192.png',
     badge: '/badge-72.png',
     tag: 'message-{conversationId}',
     data: {
       type: 'messages',
       url: '/messages',
       conversationId: 'abc123',
       from: '+1234567890',
       preview: 'Full 100 character preview...'
     }
   }
   ```

5. **Handle Click**
   - Service worker intercepts click
   - Navigates to `/messages` page
   - Could include `?conversation={id}` for direct access

## Platform Support

### Android ✅
- Fully supported on all browsers
- Shows app icon and custom badge
- Vibration pattern included

### iOS ⚠️
- Requires iOS 16.4+
- Must be installed to home screen as PWA
- User must grant notification permission

### Desktop ✅
- Chrome, Edge, Firefox fully supported
- Safari requires macOS 13+

## Security Features

- ✅ VAPID authentication
- ✅ Webhook signature verification
- ✅ Input sanitization
- ✅ Subscription validation
- ✅ Failed attempt tracking
- ✅ Automatic subscription cleanup (410 errors)

## Testing

Use the provided test script:
```bash
cd ClubOSV1-backend
node scripts/test-openphone-push.js
```

This simulates an incoming OpenPhone message and verifies push notifications are sent.

## Environment Variables

Required in backend `.env`:
```
VAPID_PUBLIC_KEY=BPSi4FpNO9pAc_g9_I0rvF5krHxRrh-d2Kl5c1p8tznb87J4JtM8XYLmG2dylr0pfU9vuOPBc_850xkCOdnnhdU
VAPID_PRIVATE_KEY=N8VNoI2cR_2Y3O9FJG7PszhLYSIomo09Sp0nSB43AzQ
VAPID_EMAIL=mailto:support@clubhouse247golf.com
OPENPHONE_WEBHOOK_SECRET=your-webhook-secret
```

Required in frontend `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPSi4FpNO9pAc_g9_I0rvF5krHxRrh-d2Kl5c1p8tznb87J4JtM8XYLmG2dylr0pfU9vuOPBc_850xkCOdnnhdU
```

## Monitoring

1. Check notification history:
   ```
   GET /api/notifications/history
   ```

2. View analytics:
   ```
   GET /api/notifications/analytics
   ```

3. Check failed subscriptions in database:
   ```sql
   SELECT * FROM push_subscriptions 
   WHERE failed_attempts >= 5 OR is_active = false;
   ```

## Troubleshooting

### Notifications not appearing
1. Check browser permissions
2. Verify user role (must be admin/operator/support)
3. Check notification preferences
4. Verify VAPID keys are configured
5. Check service worker is registered

### iOS Issues
- Ensure PWA is installed to home screen
- Check iOS version (16.4+ required)
- Verify notification permission granted

### Failed Subscriptions
- Check `push_subscriptions.failed_attempts`
- Look for 410 errors (expired subscriptions)
- Verify VAPID keys match frontend/backend

## Future Enhancements

1. **Conversation-specific subscriptions** - Subscribe to specific conversations
2. **Rich notifications** - Include action buttons (Reply, Mark Read)
3. **Notification grouping** - Group multiple messages from same sender
4. **Smart routing** - Route to specific users based on conversation assignment
5. **Fallback delivery** - Email/SMS if push fails repeatedly