# OpenPhone Messages Implementation Plan

## Overview
Implement a new "Messages" section in ClubOS that provides a real-time chat interface for text-based customer communication through OpenPhone. This will allow staff to send and receive SMS messages directly from the ClubOS interface.

## Current State
- **Existing**: OpenPhone webhook integration for receiving messages
- **Existing**: OpenPhone service for fetching conversations
- **Existing**: Database table `openphone_conversations` storing conversation history
- **Missing**: Two-way messaging capability
- **Missing**: Real-time UI for chat interface

## Implementation Steps

### Step 1: Database Schema Updates
Create migration for enhanced messaging support:

```sql
-- /backend/src/database/migrations/017_openphone_messages_enhancement.sql

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_phone_number 
ON openphone_conversations(phone_number);

CREATE INDEX IF NOT EXISTS idx_openphone_conversations_updated_at 
ON openphone_conversations(updated_at);

-- Create table for message status tracking
CREATE TABLE IF NOT EXISTS message_status (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unread count to conversations
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Add last read timestamp
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;
```

### Step 2: Backend API Enhancements

#### 2.1 Update OpenPhone Service
Add send message capability to `/backend/src/services/openphoneService.ts`:

```typescript
/**
 * Send an SMS message via OpenPhone
 */
async sendMessage(to: string, from: string, text: string): Promise<any> {
  if (!this.isConfigured) {
    throw new Error('OpenPhone not configured');
  }

  try {
    logger.info('Sending OpenPhone message', { to, from, text: text.substring(0, 50) });
    
    const response = await this.client.post('/messages', {
      to,
      from,
      text
    });

    // Store message in database
    await this.storeOutboundMessage({
      id: response.data.id,
      to,
      from,
      text,
      status: 'sent',
      createdAt: new Date().toISOString()
    });

    return response.data;
  } catch (error: any) {
    logger.error('Failed to send OpenPhone message:', error.response?.data || error.message);
    
    // Store failed message
    await this.storeOutboundMessage({
      id: `failed_${Date.now()}`,
      to,
      from,
      text,
      status: 'failed',
      error: error.message,
      createdAt: new Date().toISOString()
    });
    
    throw error;
  }
}

private async storeOutboundMessage(message: any) {
  const phoneNumber = message.to;
  
  // Update conversation with new message
  const existingConv = await db.query(
    'SELECT id, messages FROM openphone_conversations WHERE phone_number = $1',
    [phoneNumber]
  );
  
  if (existingConv.rows.length > 0) {
    const messages = [...(existingConv.rows[0].messages || []), message];
    await db.query(
      'UPDATE openphone_conversations SET messages = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(messages), existingConv.rows[0].id]
    );
  } else {
    // Create new conversation
    await db.query(
      `INSERT INTO openphone_conversations 
       (phone_number, customer_name, messages, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [phoneNumber, 'Unknown', JSON.stringify([message])]
    );
  }
}
```

#### 2.2 Create Messages Routes
Create `/backend/src/routes/messages.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';

const router = Router();

// Get all conversations
router.get('/conversations',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      
      let query = `
        SELECT 
          id,
          phone_number,
          customer_name,
          employee_name,
          messages,
          unread_count,
          last_read_at,
          created_at,
          updated_at
        FROM openphone_conversations
      `;
      
      const params: any[] = [];
      
      if (search) {
        query += ` WHERE phone_number LIKE $1 OR customer_name ILIKE $1`;
        params.push(`%${search}%`);
      }
      
      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      res.json({
        success: true,
        data: result.rows.map(row => ({
          ...row,
          lastMessage: row.messages?.[row.messages.length - 1] || null,
          messageCount: row.messages?.length || 0
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single conversation with messages
router.get('/conversations/:phoneNumber',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      const result = await db.query(
        `SELECT * FROM openphone_conversations WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }
      
      // Mark as read
      await db.query(
        `UPDATE openphone_conversations 
         SET unread_count = 0, last_read_at = NOW() 
         WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
);

// Send a message
router.post('/send',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  validate([
    body('to').isMobilePhone('any').withMessage('Invalid phone number'),
    body('text').notEmpty().withMessage('Message text is required'),
    body('from').optional().isMobilePhone('any')
  ]),
  async (req, res, next) => {
    try {
      const { to, text, from } = req.body;
      const fromNumber = from || process.env.OPENPHONE_DEFAULT_NUMBER;
      
      if (!fromNumber) {
        return res.status(400).json({
          success: false,
          error: 'No from number configured'
        });
      }
      
      // Send via OpenPhone
      const result = await openPhoneService.sendMessage(to, fromNumber, text);
      
      // Log the action
      logger.info('Message sent via OpenPhone', {
        to,
        from: fromNumber,
        userId: req.user?.id,
        messageId: result.id
      });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Mark messages as read
router.put('/conversations/:phoneNumber/read',
  authenticate,
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.params;
      
      await db.query(
        `UPDATE openphone_conversations 
         SET unread_count = 0, last_read_at = NOW() 
         WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### Step 3: Frontend Implementation

#### 3.1 Create Messages Page
Create `/frontend/src/pages/messages.tsx`:

```tsx
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { MessageCircle, Send, Search, Phone, Clock, User } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Message {
  id: string;
  text: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  status?: string;
}

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  messages: Message[];
  unread_count: number;
  updated_at: string;
  lastMessage?: Message;
}

export default function Messages() {
  const { user } = useAuthState();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Check auth
  useEffect(() => {
    if (user && !['admin', 'operator', 'support'].includes(user.role)) {
      router.push('/');
    }
  }, [user, router]);

  // Load conversations
  useEffect(() => {
    loadConversations();
    
    // Set up auto-refresh every 10 seconds
    const interval = setInterval(loadConversations, 10000);
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 }
      });
      
      if (response.data.success) {
        setConversations(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages(conversation.messages || []);
    
    // Mark as read
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/messages/conversations/${conversation.phone_number}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setConversations(prev => prev.map(c => 
        c.id === conversation.id ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    
    setSending(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/messages/send`,
        {
          to: selectedConversation.phone_number,
          text: newMessage.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Add message to local state
        const sentMessage: Message = {
          id: response.data.data.id,
          text: newMessage.trim(),
          from: process.env.NEXT_PUBLIC_OPENPHONE_NUMBER || '',
          to: selectedConversation.phone_number,
          direction: 'outbound',
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages([...messages, sentMessage]);
        setNewMessage('');
        
        // Refresh conversations to update last message
        loadConversations();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.phone_number.includes(searchTerm) || 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - Messages</title>
        <meta name="description" content="OpenPhone SMS messaging interface" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              Messages
            </h1>
            <p className="text-[var(--text-secondary)] text-sm font-light">
              Send and receive SMS messages with customers via OpenPhone
            </p>
          </div>

          {/* Messages Interface */}
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-200px)]">
              
              {/* Conversations List */}
              <div className="border-r border-[var(--border-secondary)] overflow-y-auto">
                {/* Search */}
                <div className="p-4 border-b border-[var(--border-secondary)]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="Search by name or number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Conversation Items */}
                <div className="divide-y divide-[var(--border-secondary)]">
                  {loading ? (
                    <div className="p-4 text-center text-[var(--text-muted)]">
                      Loading conversations...
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-[var(--text-muted)]">
                      No conversations found
                    </div>
                  ) : (
                    filteredConversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv)}
                        className={`p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-[var(--bg-tertiary)]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="font-medium text-sm">
                              {conv.customer_name}
                            </span>
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
                          <Phone className="w-3 h-3" />
                          <span>{conv.phone_number}</span>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {conv.lastMessage.direction === 'outbound' && 'You: '}
                            {conv.lastMessage.text}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="text-xs text-[var(--text-muted)]">
                            {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="col-span-2 flex flex-col">
                {selectedConversation ? (
                  <>
                    {/* Conversation Header */}
                    <div className="p-4 border-b border-[var(--border-secondary)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{selectedConversation.customer_name}</h3>
                          <p className="text-sm text-[var(--text-muted)]">
                            {selectedConversation.phone_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${selectedConversation.phone_number}`}
                            className="p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            title="Call customer"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((message, index) => (
                        <div
                          key={message.id || index}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${
                            message.direction === 'outbound'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-tertiary)]'
                          } rounded-lg px-4 py-2`}>
                            <p className="text-sm">{message.text}</p>
                            <p className={`text-xs mt-1 ${
                              message.direction === 'outbound' ? 'text-white/70' : 'text-[var(--text-muted)]'
                            }`}>
                              {format(new Date(message.createdAt), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-[var(--border-secondary)]">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendMessage();
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                          disabled={sending}
                        />
                        <button
                          type="submit"
                          disabled={!newMessage.trim() || sending}
                          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                    <div className="text-center">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to start messaging</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

#### 3.2 Update Navigation
Add Messages to `/frontend/src/components/Navigation.tsx`:

```typescript
// In navItems array, add after Tickets:
{ href: '/messages', label: 'Messages', roles: ['admin', 'operator', 'support'] as UserRole[], icon: '💬' },
```

### Step 4: Real-time Updates

#### 4.1 Update Webhook Handler
Enhance `/backend/src/routes/openphone.ts` webhook to increment unread count:

```typescript
// In the webhook handler, after storing the message:
if (messageData.direction === 'inbound') {
  await db.query(
    `UPDATE openphone_conversations 
     SET unread_count = unread_count + 1 
     WHERE phone_number = $1`,
    [phoneNumber]
  );
}
```

#### 4.2 Add WebSocket Support (Optional)
For real-time updates without polling:

```typescript
// /backend/src/websocket/messageSocket.ts
import { Server } from 'socket.io';

export const setupMessageSocket = (io: Server) => {
  const messageNamespace = io.of('/messages');
  
  messageNamespace.on('connection', (socket) => {
    console.log('Client connected to messages');
    
    socket.on('join-conversation', (phoneNumber) => {
      socket.join(`conversation-${phoneNumber}`);
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected from messages');
    });
  });
  
  return messageNamespace;
};

// Emit new messages from webhook:
messageNamespace.to(`conversation-${phoneNumber}`).emit('new-message', newMessage);
```

### Step 5: Testing & Deployment

#### 5.1 Testing Checklist
- [ ] Send message functionality works
- [ ] Receive messages via webhook
- [ ] Unread count updates correctly
- [ ] Search functionality works
- [ ] Auto-refresh updates conversations
- [ ] Mobile responsive design
- [ ] Role-based access control

#### 5.2 Environment Variables
Add to `.env`:
```
OPENPHONE_API_KEY=your_api_key
OPENPHONE_WEBHOOK_SECRET=your_webhook_secret
OPENPHONE_DEFAULT_NUMBER=+1234567890
```

#### 5.3 Deployment Steps
1. Deploy backend first (migrations will run)
2. Deploy frontend
3. Configure OpenPhone webhook URL: `https://your-api.com/api/openphone/webhook`
4. Test with a real SMS conversation

## Security Considerations

1. **Rate Limiting**: Add rate limiting to send endpoint
2. **Message Validation**: Sanitize message content
3. **Phone Number Validation**: Ensure proper format
4. **Audit Logging**: Log all sent messages
5. **Permission Checks**: Verify user can send on behalf of organization

## Future Enhancements

1. **Message Templates**: Pre-defined responses
2. **Bulk Messaging**: Send to multiple recipients
3. **Media Support**: MMS attachments
4. **Contact Management**: Link to customer profiles
5. **Analytics**: Message volume tracking
6. **Automated Responses**: AI-powered suggestions

## Estimated Timeline

- **Phase 1** (4-6 hours): Basic messaging interface
- **Phase 2** (2-3 hours): Real-time updates
- **Phase 3** (2 hours): Polish and testing
- **Total**: 8-11 hours

---

This implementation provides a complete SMS messaging solution integrated with OpenPhone, allowing staff to communicate with customers directly from ClubOS.