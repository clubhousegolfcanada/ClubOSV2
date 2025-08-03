/**
 * Messaging Module - Consolidated routes for all messaging functionality
 * 
 * Combines:
 * - OpenPhone (SMS/calls)
 * - Messages management
 * - Contacts
 * - Notifications
 * - Tone analysis
 */

import { createRouteModule, createHealthRoute } from '../routeFactory';
import { authenticate } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rateLimiter';
import { roleGuard } from '../../middleware/roleGuard';

// Import handlers
import * as conversationHandlers from './handlers/conversations';
import * as messageHandlers from './handlers/messages';
import * as contactHandlers from './handlers/contacts';
import * as notificationHandlers from './handlers/notifications';
import * as webhookHandlers from './handlers/webhooks';

// Create the messaging module
export const messagingModule = createRouteModule({
  prefix: '/messaging',
  middleware: [authenticate],
  rateLimiter,
  version: 'v2',
  routes: [
    // Health check
    createHealthRoute('messaging'),

    // ===== Conversations =====
    {
      method: 'get',
      path: '/conversations',
      description: 'List all conversations',
      handlers: [conversationHandlers.listConversations]
    },
    {
      method: 'get',
      path: '/conversations/:conversationId',
      description: 'Get conversation details',
      handlers: [conversationHandlers.getConversation]
    },
    {
      method: 'put',
      path: '/conversations/:conversationId/status',
      description: 'Update conversation status',
      handlers: [conversationHandlers.updateConversationStatus]
    },
    {
      method: 'post',
      path: '/conversations/:conversationId/assign',
      description: 'Assign conversation to user',
      handlers: [roleGuard(['admin', 'operator']), conversationHandlers.assignConversation]
    },

    // ===== Messages =====
    {
      method: 'get',
      path: '/messages',
      description: 'List messages with filters',
      handlers: [messageHandlers.listMessages]
    },
    {
      method: 'post',
      path: '/messages/send',
      description: 'Send a message',
      handlers: [messageHandlers.sendMessage]
    },
    {
      method: 'get',
      path: '/messages/unread',
      description: 'Get unread message count',
      handlers: [messageHandlers.getUnreadCount]
    },
    {
      method: 'put',
      path: '/messages/:messageId/read',
      description: 'Mark message as read',
      handlers: [messageHandlers.markAsRead]
    },
    {
      method: 'post',
      path: '/messages/ai-suggestion',
      description: 'Get AI message suggestion',
      handlers: [messageHandlers.getAISuggestion]
    },

    // ===== Contacts =====
    {
      method: 'get',
      path: '/contacts',
      description: 'List all contacts',
      handlers: [contactHandlers.listContacts]
    },
    {
      method: 'get',
      path: '/contacts/:contactId',
      description: 'Get contact details',
      handlers: [contactHandlers.getContact]
    },
    {
      method: 'put',
      path: '/contacts/:contactId',
      description: 'Update contact',
      handlers: [contactHandlers.updateContact]
    },
    {
      method: 'post',
      path: '/contacts/sync',
      description: 'Sync contacts from OpenPhone',
      handlers: [roleGuard(['admin']), contactHandlers.syncContacts]
    },

    // ===== Notifications =====
    {
      method: 'get',
      path: '/notifications/preferences',
      description: 'Get notification preferences',
      handlers: [notificationHandlers.getPreferences]
    },
    {
      method: 'put',
      path: '/notifications/preferences',
      description: 'Update notification preferences',
      handlers: [notificationHandlers.updatePreferences]
    },
    {
      method: 'post',
      path: '/notifications/subscribe',
      description: 'Subscribe to push notifications',
      handlers: [notificationHandlers.subscribeToPush]
    },
    {
      method: 'delete',
      path: '/notifications/subscribe',
      description: 'Unsubscribe from push notifications',
      handlers: [notificationHandlers.unsubscribeFromPush]
    },
    {
      method: 'post',
      path: '/notifications/test',
      description: 'Send test notification',
      handlers: [notificationHandlers.sendTestNotification]
    },

    // ===== Webhooks (public, no auth) =====
    {
      method: 'post',
      path: '/webhooks/openphone',
      description: 'OpenPhone webhook endpoint',
      handlers: [webhookHandlers.handleOpenPhoneWebhook]
    },

    // ===== Debug endpoints (admin only) =====
    {
      method: 'get',
      path: '/debug/status',
      description: 'Get messaging system status',
      handlers: [roleGuard(['admin']), messageHandlers.getDebugStatus]
    },
    {
      method: 'post',
      path: '/debug/refresh-cache',
      description: 'Refresh message cache',
      handlers: [roleGuard(['admin']), messageHandlers.refreshCache]
    }
  ]
});

// Export router for use in main app
export default messagingModule.router;