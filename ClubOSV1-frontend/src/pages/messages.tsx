import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { MessageCircle, Send, Search, Phone, Clock, User, ArrowLeft, Bell, BellOff } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Message {
  id: string;
  text?: string;
  body?: string;
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
  const { isSupported, permission, isSubscribed, isLoading: notificationLoading, subscribe, unsubscribe } = usePushNotifications();

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
      if (!token) {
        console.error('No auth token found');
        toast.error('Please log in again');
        router.push('/login');
        return;
      }

      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 }
      });
      
      if (response.data.success) {
        setConversations(response.data.data);
      } else {
        console.error('API returned success: false', response.data);
        toast.error(response.data.error || 'Failed to load conversations');
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: `${API_URL}/messages/conversations`
      });
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        router.push('/login');
      } else if (error.response?.status === 404) {
        toast.error('Messages API not found. Please check backend deployment.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to load conversations');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    // Ensure messages is always an array
    const conversationMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
    setMessages(conversationMessages);
    
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
          from: response.data.data.from || '',
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

  const filteredConversations = conversations.filter(c => {
    if (!c) return false;
    const phoneMatch = c.phone_number && c.phone_number.includes(searchTerm);
    const nameMatch = c.customer_name && c.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    return phoneMatch || nameMatch;
  });

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
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
                  Messages
                </h1>
                <p className="text-[var(--text-secondary)] text-sm font-light">
                  Send and receive SMS messages with customers via OpenPhone
                </p>
              </div>
              
              {/* Push Notification Toggle */}
              {isSupported && (
                <div className="flex items-center gap-2">
                  {notificationLoading ? (
                    <div className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)]">
                      <span className="text-sm text-[var(--text-muted)]">Loading...</span>
                    </div>
                  ) : isSubscribed ? (
                    <button
                      onClick={unsubscribe}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Disable push notifications"
                    >
                      <Bell className="w-4 h-4" />
                      <span className="text-sm hidden sm:inline">Notifications On</span>
                    </button>
                  ) : (
                    <button
                      onClick={subscribe}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Enable push notifications"
                    >
                      <BellOff className="w-4 h-4" />
                      <span className="text-sm hidden sm:inline">Notifications Off</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Messages Interface */}
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-200px)]">
              
              {/* Conversations List */}
              <div className={`${selectedConversation ? 'hidden md:block' : 'block'} border-r border-[var(--border-secondary)] overflow-y-auto`}>
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
                              {conv.customer_name || 'Unknown'}
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
                        {conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.body) && (
                          <p className="text-xs text-[var(--text-secondary)] truncate">
                            {conv.lastMessage.direction === 'outbound' && 'You: '}
                            {conv.lastMessage.text || conv.lastMessage.body}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="text-xs text-[var(--text-muted)]">
                            {conv.updated_at && !isNaN(new Date(conv.updated_at).getTime())
                              ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })
                              : 'Recently'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className={`${selectedConversation ? 'block' : 'hidden md:block'} col-span-2 flex flex-col`}>
                {selectedConversation ? (
                  <>
                    {/* Conversation Header */}
                    <div className="p-4 border-b border-[var(--border-secondary)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Mobile back button */}
                          <button
                            onClick={() => setSelectedConversation(null)}
                            className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            aria-label="Back to conversations"
                          >
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h3 className="font-semibold">{selectedConversation.customer_name || 'Unknown'}</h3>
                            <p className="text-sm text-[var(--text-muted)]">
                              {selectedConversation.phone_number || 'No phone number'}
                            </p>
                          </div>
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
                      {messages && messages.length > 0 ? messages.map((message, index) => (
                        <div
                          key={message.id || index}
                          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${
                            message.direction === 'outbound'
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--bg-tertiary)]'
                          } rounded-lg px-4 py-2`}>
                            <p className="text-sm">{message.text || message.body || ''}</p>
                            <p className={`text-xs mt-1 ${
                              message.direction === 'outbound' ? 'text-white/70' : 'text-[var(--text-muted)]'
                            }`}>
                              {message.createdAt && !isNaN(new Date(message.createdAt).getTime()) 
                                ? format(new Date(message.createdAt), 'h:mm a')
                                : 'Unknown time'}
                            </p>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center text-[var(--text-muted)] py-8">
                          <p>No messages yet. Send a message to start the conversation.</p>
                        </div>
                      )}
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