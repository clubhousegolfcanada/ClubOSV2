# Push Notification Implementation Plan

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│Service Worker│────▶│Push Service │
│             │     │              │     │  (FCM/APNS) │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  ClubOS API │────▶│  Web Push    │────▶│  OpenPhone  │
│             │     │   Library    │     │   Webhook   │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Implementation Steps

### Phase 1: Backend Infrastructure

#### 1.1 Database Schema
```sql
-- Push subscription storage
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  failed_attempts INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, endpoint)
);

-- Notification history for debugging
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id, is_active);
CREATE INDEX idx_notification_history_user_date ON notification_history(user_id, sent_at);
```

#### 1.2 Environment Variables
```bash
# Add to .env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_EMAIL=mailto:support@clubhouse247golf.com
```

#### 1.3 Backend Routes
```typescript
// /api/notifications/subscribe
POST - Subscribe to push notifications
DELETE - Unsubscribe from push notifications
GET - Check subscription status

// /api/notifications/test
POST - Send test notification (admin only)
```

### Phase 2: Frontend Implementation

#### 2.1 Service Worker
```javascript
// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  // Prevent duplicate notifications
  if (self.clients) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        const isAppOpen = clients.some(client => 
          client.url.includes('/messages') && client.focused
        );
        
        if (!isAppOpen) {
          return self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/logo-192.png',
            badge: '/badge-72.png',
            tag: data.tag || 'message',
            data: data.data,
            requireInteraction: false,
            silent: false
          });
        }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/messages')
  );
});
```

#### 2.2 React Hook
```typescript
// hooks/usePushNotifications.ts
export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const subscribe = async () => {
    // Implementation details...
  };
  
  const unsubscribe = async () => {
    // Implementation details...
  };
  
  return { permission, isSubscribed, subscribe, unsubscribe };
};
```

### Phase 3: Integration Points

#### 3.1 OpenPhone Webhook Enhancement
```typescript
// When new message arrives
if (message.direction === 'inbound') {
  // Send push notification to assigned users
  await notificationService.sendToUser(userId, {
    title: `New message from ${message.from}`,
    body: message.text.substring(0, 100),
    data: {
      conversationId: message.conversationId,
      phoneNumber: message.from
    }
  });
}
```

#### 3.2 Notification Preferences
```typescript
interface NotificationPreferences {
  messages: {
    enabled: boolean;
    sound: boolean;
    vibrate: boolean;
    quietHours: {
      enabled: boolean;
      start: string; // "22:00"
      end: string;   // "08:00"
    };
  };
}
```

## Mobile-Specific Optimizations

### 1. Session Management
- Implement "Keep me logged in" with refresh tokens
- Store minimal data in service worker for offline access
- Use IndexedDB for conversation cache

### 2. Performance
- Lazy load notification permission request
- Batch notification delivery
- Implement exponential backoff for failed deliveries

### 3. Battery & Data
- Respect user's data saver mode
- Minimize notification payload size
- Use notification channels for importance levels

## Security Measures

### 1. Authentication
- Verify user ownership of push subscription
- Rotate VAPID keys periodically
- Implement subscription expiration

### 2. Content Security
- Never include sensitive data in notifications
- Use notification IDs instead of content
- Encrypt notification payloads

### 3. Rate Limiting
- Max 10 notifications per hour per user
- Implement notification cooldown periods
- Track and prevent notification spam

## Error Handling

### 1. Subscription Failures
```typescript
// Auto-cleanup invalid subscriptions
if (error.statusCode === 410) {
  await db.query(
    'UPDATE push_subscriptions SET is_active = false WHERE endpoint = $1',
    [subscription.endpoint]
  );
}
```

### 2. Permission Handling
- Graceful degradation when notifications denied
- In-app notification fallback
- Clear messaging about notification benefits

## Testing Strategy

### 1. Browser Testing
- Chrome (Desktop/Android): Full support
- Safari (macOS/iOS): PWA required
- Firefox (Desktop/Android): Full support
- Edge: Full support

### 2. Edge Cases
- Multiple device subscriptions
- Network interruptions
- Token expiration during notification
- Background app termination

## Monitoring & Analytics

### 1. Metrics to Track
- Notification delivery rate
- Click-through rate
- Subscription/unsubscription rate
- Failed delivery reasons

### 2. Debug Tools
- Notification history viewer
- Push subscription manager
- Test notification sender

## Rollout Plan

### Week 1
- Backend infrastructure
- Database migrations
- Basic service worker

### Week 2
- Frontend integration
- Permission flow
- Testing on staging

### Week 3
- Mobile optimization
- Error handling
- Performance tuning

### Week 4
- Production rollout
- Monitoring setup
- Documentation

## Potential Issues & Mitigations

### Issue 1: iOS Safari Limitations
**Problem**: No web push support outside PWA
**Solution**: Prompt iOS users to "Add to Home Screen"

### Issue 2: Notification Fatigue
**Problem**: Users overwhelmed by notifications
**Solution**: Smart notification grouping and quiet hours

### Issue 3: Offline Messages
**Problem**: Messages sent while device offline
**Solution**: Queue and retry with exponential backoff

### Issue 4: Security Concerns
**Problem**: Push endpoints could be compromised
**Solution**: Regular endpoint rotation and validation

### Issue 5: Performance Impact
**Problem**: Service worker affects page load
**Solution**: Lazy registration after page interaction

## Success Criteria

1. 80% of active users enable notifications
2. <2% unsubscribe rate per month
3. 99.9% notification delivery success
4. <100ms notification latency
5. Zero security incidents

## References

- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)