// ClubOS Service Worker - Push Notifications & Offline Support
// Last updated: 2025-08-31 - Fixed apiClient double API issue
const CACHE_NAME = 'clubos-v6-apiclient-fix'; // Force cache clear after fixing apiClient paths
const OFFLINE_URL = '/offline.html';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/offline.html',
        '/manifest.json',
        '/clubos-icon-192.png'
      ]);
    })
  );
  
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => clients.claim())
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip caching for API requests
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html');
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Push event - handle incoming push notifications.
// CRITICAL: event.waitUntil() MUST always be called. On Android, if the push handler
// returns without calling waitUntil(), Chrome may terminate the service worker before
// showNotification completes, causing the notification to silently disappear.
// This was a major cause of "random" missing notifications on Android.
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  // Always wrap in waitUntil — even error paths must show a fallback notification.
  // Android Chrome kills the SW if waitUntil isn't called, dropping the notification.
  event.waitUntil(
    (async () => {
      let notification = null;

      // Try to parse the push payload
      if (event.data) {
        try {
          notification = event.data.json();
        } catch (e) {
          console.error('[SW] Failed to parse notification data:', e);
          // Try as plain text fallback
          try {
            const text = event.data.text();
            notification = { title: 'ClubOS', body: text || 'New notification' };
          } catch {
            // Complete parse failure — fallback below
          }
        }
      }

      // Fallback: if no data or parse failed entirely, still show something.
      // A visible notification is always better than a silent drop.
      if (!notification) {
        notification = {
          title: 'ClubOS',
          body: 'New update available — tap to check',
          data: { type: 'messages', url: '/messages' }
        };
      }

      const options = {
        body: notification.body || 'New notification from ClubOS',
        icon: notification.icon || '/clubos-icon-192.png',
        badge: notification.badge || '/clubos-badge-72.png',
        vibrate: notification.vibrate || [200, 100, 200, 100, 200],
        data: notification.data || {},
        requireInteraction: notification.requireInteraction !== undefined ? notification.requireInteraction : true,
        actions: notification.actions || [],
        tag: notification.tag || 'clubos-notification',
        renotify: true,
        silent: notification.silent || false,
        sound: notification.sound || 'default'
      };

      return self.registration.showNotification(
        notification.title || 'ClubOS',
        options
      );
    })()
  );
});

// Notification click event - handle notification interactions
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Route based on notification type
  if (data.type === 'message') {
    url = '/messages';
    if (data.conversationId) {
      url += `?conversation=${data.conversationId}`;
    }
  } else if (data.type === 'ticket') {
    url = `/tickets/${data.ticketId}`;
  } else if (data.url) {
    url = data.url;
  }

  // Handle action button clicks
  if (event.action) {
    if (event.action === 'view-message' && data.conversationId) {
      url = `/messages?conversation=${data.conversationId}`;
    } else if (event.action === 'mark-read' && data.conversationId) {
      // TODO: Call API to mark message as read
      return;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if a window is already open
        for (const client of windowClients) {
          if (client.url.includes('clubos') && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync for checking new messages
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-messages') {
    event.waitUntil(checkForNewMessages());
  }
});

async function checkForNewMessages() {
  try {
    // This would check for new messages when the app is closed
    // Implementation depends on backend API
    console.log('[SW] Checking for new messages in background...');
  } catch (error) {
    console.error('[SW] Error checking messages:', error);
  }
}